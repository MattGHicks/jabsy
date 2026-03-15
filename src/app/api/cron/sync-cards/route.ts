import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchEventById } from '@/lib/api/espn'
import { mapEspnEvent, toFightInsert } from '@/lib/api/sync'
import { validateEventData, lookupSherdogUrls, lookupSherdogUrlsWithAI, findUfcEventFmidWithClaude } from '@/lib/api/claude-search'
import { fetchUfcLiveEvent } from '@/lib/api/ufc'
import type { ValidationWarning } from '@/lib/api/types'
import type { Json } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * Daily fight card sync cron job.
 * Runs at 6 AM ET (11:00 UTC) to check for fight card changes on upcoming events.
 * Logs validation warnings to api_sync_log.
 * On ESPN failure, attempts Claude cross-validation.
 * Protected with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const results: { eventId: string; name: string; added: number; updated: number; cancelled: number; warnings: number }[] = []

  try {
    // Find events that need syncing
    const { data: events } = await adminClient
      .from('events')
      .select('id, name, espn_event_id, start_time, ufc_event_fmid')
      .eq('status', 'upcoming')
      .eq('auto_sync_enabled', true)
      .not('espn_event_id', 'is', null)

    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'No events to sync', results: [] })
    }

    for (const event of events) {
      const changes = { added: 0, updated: 0, cancelled: 0 }
      let eventWarnings: ValidationWarning[] = []

      try {
        const espnEvent = await fetchEventById(event.espn_event_id!)
        if (!espnEvent) {
          // Log that ESPN couldn't find this event
          await adminClient.from('api_sync_log').insert({
            sync_type: 'card_update',
            event_id: event.id,
            api_source: 'espn',
            status: 'warning',
            request_count: 1,
            details: { type: 'event_not_found', espn_event_id: event.espn_event_id },
          })
          continue
        }

        const mappedResult = mapEspnEvent(espnEvent, new Set())
        const mapped = mappedResult.data
        eventWarnings = mappedResult.warnings

        // Log validation warnings if any
        if (eventWarnings.length > 0) {
          await adminClient.from('api_sync_log').insert({
            sync_type: 'validation',
            event_id: event.id,
            api_source: 'espn',
            status: 'warning',
            request_count: 0,
            details: { warnings: eventWarnings } as unknown as Json,
          })
        }

        // Get existing fights
        const { data: existingFights } = await adminClient
          .from('fights')
          .select('*')
          .eq('event_id', event.id)

        const existingByEspnId = new Map(
          (existingFights ?? [])
            .filter(f => f.espn_competition_id)
            .map(f => [f.espn_competition_id!, f])
        )

        const espnCompIds = new Set(mapped.fights.map(f => f.espnCompetitionId))

        // Update or add fights
        for (const fight of mapped.fights) {
          const existing = existingByEspnId.get(fight.espnCompetitionId)

          if (existing) {
            if (existing.sync_status === 'modified') continue

            await adminClient
              .from('fights')
              .update({
                red_name: fight.redName,
                red_record: fight.redRecord,
                blue_name: fight.blueName,
                blue_record: fight.blueRecord,
                weight_class: fight.weightClass,
                scheduled_rounds: fight.scheduledRounds,
                is_main_event: fight.isMainEvent,
                bout_order: fight.boutOrder,
                last_synced_at: new Date().toISOString(),
              })
              .eq('id', existing.id)

            changes.updated++
          } else {
            const insert = toFightInsert(fight, event.id)
            await adminClient.from('fights').insert(insert)
            changes.added++
          }
        }

        // Cancel removed fights
        for (const existing of existingFights ?? []) {
          if (
            existing.espn_competition_id &&
            !espnCompIds.has(existing.espn_competition_id) &&
            existing.status === 'scheduled'
          ) {
            await adminClient
              .from('fights')
              .update({ status: 'cancelled' })
              .eq('id', existing.id)
            changes.cancelled++
          }
        }

        // Resolve any search-style Sherdog URLs to exact profile URLs
        try {
          const { data: fightsNeedingUrls } = await adminClient
            .from('fights')
            .select('id, red_name, red_sherdog_url, blue_name, blue_sherdog_url')
            .eq('event_id', event.id)
            .or('red_sherdog_url.like.%fightfinder%,blue_sherdog_url.like.%fightfinder%')

          if (fightsNeedingUrls && fightsNeedingUrls.length > 0) {
            const namesNeeding = new Set<string>()
            for (const f of fightsNeedingUrls) {
              if (f.red_sherdog_url?.includes('fightfinder')) namesNeeding.add(f.red_name)
              if (f.blue_sherdog_url?.includes('fightfinder')) namesNeeding.add(f.blue_name)
            }

            const { results: sherdogUrls } = await lookupSherdogUrls([...namesNeeding])

            // AI fallback for fighters the scraper missed (name mismatches, special chars)
            const stillMissing = [...namesNeeding].filter(name => !sherdogUrls[name])
            if (stillMissing.length > 0) {
              try {
                const aiUrls = await lookupSherdogUrlsWithAI(stillMissing)
                Object.assign(sherdogUrls, aiUrls)
              } catch {
                // AI fallback is best-effort
              }
            }

            for (const fight of fightsNeedingUrls) {
              const update: Record<string, string> = {}
              if (fight.red_sherdog_url?.includes('fightfinder') && sherdogUrls[fight.red_name]) {
                update.red_sherdog_url = sherdogUrls[fight.red_name]
              }
              if (fight.blue_sherdog_url?.includes('fightfinder') && sherdogUrls[fight.blue_name]) {
                update.blue_sherdog_url = sherdogUrls[fight.blue_name]
              }
              if (Object.keys(update).length > 0) {
                await adminClient.from('fights').update(update).eq('id', fight.id)
              }
            }
          }
        } catch {
          // Sherdog lookup is best-effort
        }

        // Update event metadata (start time, name, venue may change if fights are cancelled/rescheduled)
        const eventUpdate: Record<string, string | null> = {
          last_synced_at: new Date().toISOString(),
          name: mapped.name,
          venue: mapped.venue,
        }
        if (mapped.startTime !== event.start_time) {
          eventUpdate.start_time = mapped.startTime
          // Keep lock_time in sync with start_time
          eventUpdate.lock_time = mapped.startTime
        }
        await adminClient
          .from('events')
          .update(eventUpdate)
          .eq('id', event.id)

        // Sync UFC CloudFront API IDs (fmid + per-fight IDs) if not yet populated
        try {
          await syncUfcIds(adminClient, event)
        } catch {
          // UFC ID sync is best-effort — doesn't block the main sync
        }

        results.push({ eventId: event.id, name: event.name, ...changes, warnings: eventWarnings.length })
      } catch (err) {
        console.error(`Sync failed for event ${event.id}:`, err)

        // Log error to DB
        await adminClient.from('api_sync_log').insert({
          sync_type: 'card_update',
          event_id: event.id,
          api_source: 'espn',
          status: 'error',
          request_count: 1,
          details: { error: String(err) },
        })

        // Try Claude validation as cross-check (daily only, not live)
        try {
          const { data: existingFights } = await adminClient
            .from('fights')
            .select('red_name, blue_name')
            .eq('event_id', event.id)

          if (existingFights && existingFights.length > 0) {
            const validation = await validateEventData(
              event.name,
              existingFights.map(f => ({ red: f.red_name, blue: f.blue_name }))
            )
            if (!validation.valid) {
              await adminClient.from('api_sync_log').insert({
                sync_type: 'validation',
                event_id: event.id,
                api_source: 'claude',
                status: 'warning',
                request_count: 1,
                details: { issues: validation.issues },
              })
            }
          }
        } catch {
          // Claude validation is best-effort
        }
      }
    }

    // Log overall sync result
    const hasWarnings = results.some(r => r.warnings > 0)
    await adminClient.from('api_sync_log').insert({
      sync_type: 'card_update',
      api_source: 'espn',
      status: results.length > 0 ? (hasWarnings ? 'partial' : 'success') : 'partial',
      request_count: events.length,
      details: { results },
    })

    return NextResponse.json({ message: 'Sync complete', results })
  } catch (err) {
    console.error('Card sync cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * Fetch the UFC CloudFront event fmid from the UFC.com event page and
 * populate ufc_event_fmid on the event + ufc_fight_id on each fight.
 * Matches UFC fights to DB fights by normalizing fighter names.
 * Safe to call multiple times — skips fields already populated.
 */
async function syncUfcIds(
  adminClient: ReturnType<typeof createAdminClient>,
  event: { id: string; name: string; ufc_event_fmid: string | null; start_time: string }
) {
  // Step 1: Get the fmid if we don't have it yet
  let fmid = event.ufc_event_fmid

  if (!fmid) {
    const slug = eventNameToSlug(event.name)
    // Try scraping UFC.com event page for the fmid first
    try {
      const res = await fetch(`https://www.ufc.com/event/${slug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (res.ok) {
        const html = await res.text()
        const match = html.match(/"event_fmid"\s*:\s*"(\d+)"/)
        if (match?.[1]) {
          fmid = match[1]
          await adminClient.from('events').update({ ufc_event_fmid: fmid }).eq('id', event.id)
        }
      }
    } catch { /* fall through to Claude */ }

    // If scraping failed, try sequential ID guessing from the last known fmid
    if (!fmid) {
      const { data: lastEvent } = await adminClient
        .from('events')
        .select('ufc_event_fmid')
        .not('ufc_event_fmid', 'is', null)
        .lt('start_time', event.start_time)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastEvent?.ufc_event_fmid) {
        const lastId = parseInt(lastEvent.ufc_event_fmid, 10)
        for (let candidate = lastId + 1; candidate <= lastId + 5; candidate++) {
          try {
            const ufcFights = await fetchUfcLiveEvent(String(candidate))
            if (!ufcFights) continue
            // Verify by checking if main event fighters match
            const mainEventFighters = ufcFights[0]
            const eventNameLower = event.name.toLowerCase()
            const redMatch = mainEventFighters?.redName && eventNameLower.includes(mainEventFighters.redName.split(' ').pop()!.toLowerCase())
            const blueMatch = mainEventFighters?.blueName && eventNameLower.includes(mainEventFighters.blueName.split(' ').pop()!.toLowerCase())
            if (redMatch || blueMatch) {
              fmid = String(candidate)
              await adminClient.from('events').update({ ufc_event_fmid: fmid }).eq('id', event.id)
              break
            }
          } catch { continue }
        }
      }
    }

    // If sequential guessing failed, ask Claude Haiku with web search as last resort
    if (!fmid) {
      fmid = await findUfcEventFmidWithClaude(event.name, slug)
      if (fmid) {
        await adminClient.from('events').update({ ufc_event_fmid: fmid }).eq('id', event.id)
      }
    }

    if (!fmid) return
  }

  // Step 2: Get UFC fight IDs and match to DB fights by name
  const ufcFights = await fetchUfcLiveEvent(fmid)
  if (!ufcFights) return

  const { data: dbFights } = await adminClient
    .from('fights')
    .select('id, red_name, blue_name, ufc_fight_id')
    .eq('event_id', event.id)

  if (!dbFights) return

  const normalize = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

  for (const dbFight of dbFights) {
    if (dbFight.ufc_fight_id) continue // already have it

    const redNorm = normalize(dbFight.red_name)
    const blueNorm = normalize(dbFight.blue_name)

    const match = ufcFights.find(uf => {
      const ufRed = uf.redName ? normalize(uf.redName) : ''
      const ufBlue = uf.blueName ? normalize(uf.blueName) : ''
      return (
        (ufRed.includes(redNorm.split(' ').pop()!) || redNorm.includes(ufRed.split(' ').pop()!)) &&
        (ufBlue.includes(blueNorm.split(' ').pop()!) || blueNorm.includes(ufBlue.split(' ').pop()!))
      )
    })

    if (match) {
      await adminClient
        .from('fights')
        .update({ ufc_fight_id: match.fightId })
        .eq('id', dbFight.id)
    }
  }
}

/**
 * Convert an event name like "UFC Fight Night: Emmett vs. Vallejos"
 * to a UFC.com URL slug like "ufc-fight-night-emmett-vs-vallejos".
 */
function eventNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
