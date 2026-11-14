import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchEventById, mapFightStatus } from '@/lib/api/espn'
import { fetchUfcLiveEvent } from '@/lib/api/ufc'
import { fetchFightResultsWithClaude } from '@/lib/api/claude-search'
import { alignUfcFight, espnResult, resolveResult, ufcResult, describeResult, type FightResult } from '@/lib/api/results'
import { runResultVerification } from '@/lib/api/verify-results'
import type { Json } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * Live results polling cron job — three-tier fallback system.
 * Runs every 60 seconds via Vercel cron.
 *
 * Tier 1: ESPN API (primary) — bout status + completion, with the result
 *   taken from the official UFC feed when it has one and otherwise from ESPN's
 *   explicit "Unofficial Winner" line. A completed bout with neither is left
 *   pending until the next poll; results are never guessed.
 *   → If ESPN consecutive_failures >= 1, skip to Tier 2
 *
 * Tier 2: UFC CloudFront API (fallback when ESPN is down)
 *   → Uses ufc_event_fmid / ufc_fight_id
 *
 * Tier 3: Claude web_search (last resort when both APIs down > 3 mins)
 *   → Rate-limited to one call per event per 3 minutes via api_sync_log
 *   → Only high-confidence results are written
 *
 * Result verification (every 5 mins while live, every 30 mins for 4 days after):
 *   → Re-checks every stored result against the UFC feed + ESPN, corrects
 *     mismatches, and re-checks every pick's points. See lib/api/verify-results.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  try {
    // Auto-transition upcoming events past lock_time to live
    await adminClient
      .from('events')
      .update({ status: 'live' })
      .eq('status', 'upcoming')
      .lte('lock_time', now)

    // Find live events with ESPN IDs
    const { data: liveEvents } = await adminClient
      .from('events')
      .select('id, name, espn_event_id, ufc_event_fmid, start_time')
      .eq('status', 'live')
      .not('espn_event_id', 'is', null)

    const allUpdates: { eventId: string; fightId: string; winner: string; method: string; round: number | null; tier: string }[] = []
    const allErrors: { eventId: string; type: string; detail: string }[] = []

    if (liveEvents && liveEvents.length > 0) {
      // Check ESPN health once — applies to all events this run
      const espnHealthy = await isEspnHealthy(adminClient)

      for (const event of liveEvents) {
        try {
          const { updates, errors } = await processLiveEvent(adminClient, event as typeof event & { espn_event_id: string }, espnHealthy)
          allUpdates.push(...updates)
          allErrors.push(...errors)
        } catch (err) {
          console.error(`Live results failed for event ${event.id}:`, err)
          allErrors.push({ eventId: event.id, type: 'unhandled_error', detail: String(err) })
        }
      }
    }

    // Backstop: re-verify results of live and recently completed events.
    // Self-throttled (every 5 min live / 30 min after), so safe to call each run.
    let verification: Awaited<ReturnType<typeof runResultVerification>> = []
    try {
      verification = await runResultVerification(adminClient)
    } catch (err) {
      console.error('Result verification error:', err)
    }

    await detectStuckEvents(adminClient)

    if (!liveEvents || liveEvents.length === 0) {
      return NextResponse.json({ message: 'No live events', verified: verification.length })
    }

    if (allUpdates.length > 0 || allErrors.length > 0) {
      await adminClient.from('api_sync_log').insert({
        sync_type: 'live_results',
        api_source: 'espn',
        status: allErrors.length > 0 ? (allUpdates.length > 0 ? 'partial' : 'error') : 'success',
        request_count: liveEvents.length,
        details: {
          updates: allUpdates,
          errors: allErrors.length > 0 ? allErrors : undefined,
        } as unknown as Json,
      })
    }

    return NextResponse.json({
      message: `Polled ${liveEvents.length} live events`,
      verified: verification.length,
      resultsApplied: allUpdates.length,
      updates: allUpdates,
      errors: allErrors.length > 0 ? allErrors : undefined,
    })
  } catch (err) {
    console.error('Live results cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── Per-event orchestrator ───────────────────────────────────────────────────

async function processLiveEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  event: { id: string; name: string; espn_event_id: string; ufc_event_fmid: string | null; start_time: string },
  espnHealthy: boolean
) {
  const updates: { eventId: string; fightId: string; winner: string; method: string; round: number | null; tier: string }[] = []
  const errors: { eventId: string; type: string; detail: string }[] = []

  // ── Tier 1: ESPN ─────────────────────────────────────────────────────────────
  if (espnHealthy) {
    try {
      const espnEvent = await fetchEventById(event.espn_event_id)
      if (!espnEvent) {
        errors.push({ eventId: event.id, type: 'espn_event_not_found', detail: `ESPN event ${event.espn_event_id} not found` })
      } else {
        const { data: existingFights } = await adminClient
          .from('fights')
          .select('id, red_name, blue_name, espn_competition_id, ufc_fight_id, status, result_winner')
          .eq('event_id', event.id)

        const fightsByEspnId = new Map(
          (existingFights ?? [])
            .filter(f => f.espn_competition_id)
            .map(f => [f.espn_competition_id!, f])
        )

        // Official UFC results for this event (best-effort) — preferred over ESPN
        const ufcFights = event.ufc_event_fmid
          ? await fetchUfcLiveEvent(event.ufc_event_fmid).catch(() => null)
          : null

        for (const comp of espnEvent.competitions) {
          const dbFight = fightsByEspnId.get(comp.id)
          if (!dbFight) continue
          if (dbFight.status === 'final' || dbFight.result_winner) continue

          const espnStatus = mapFightStatus(comp.status)
          if (espnStatus === 'live' && dbFight.status === 'scheduled') {
            await adminClient.from('fights').update({ status: 'live' }).eq('id', dbFight.id)
          }

          if (!comp.status.type.completed) continue

          const ufcRaw = ufcFights?.find(f => f.fightId === dbFight.ufc_fight_id)
            ?? ufcFights?.find(f => alignUfcFight(f, dbFight.red_name, dbFight.blue_name))
          const ufcAligned = ufcRaw ? alignUfcFight(ufcRaw, dbFight.red_name, dbFight.blue_name) : null
          const resolved = resolveResult(ufcAligned ? ufcResult(ufcAligned) : null, espnResult(comp))

          if (!resolved) {
            // ESPN says the bout is over but neither feed states a result yet
            // (ESPN often marks it final before posting the result line).
            // Writing a guess here is how fights got scored wrong — wait.
            await logOncePerHour(adminClient, 'live_results', event.id, 'warning', {
              type: 'result_pending',
              fight_id: dbFight.id,
              competition_id: comp.id,
              details_texts: (comp.details ?? []).slice(0, 6).map(d => d.type?.text),
            })
            continue
          }

          if (resolved.conflict) {
            await logOncePerHour(adminClient, 'live_results', event.id, 'warning', {
              type: 'espn_ufc_disagree',
              fight_id: dbFight.id,
              used: `ufc_api ${describeResult(resolved.result)}`,
              espn: describeResult(espnResult(comp)),
            })
          }

          const error = await writeResult(adminClient, dbFight.id, resolved.result, resolved.source)
          if (!error) {
            updates.push({ eventId: event.id, fightId: dbFight.id, ...resolved.result, tier: resolved.source === 'ufc_api' ? 'espn+ufc' : 'espn' })
          } else {
            errors.push({ eventId: event.id, type: 'update_failed', detail: error })
          }
        }

        // If ESPN processed successfully (even with 0 new results), we're done for this event
        if (errors.filter(e => e.eventId === event.id && e.type !== 'corners_failed' && e.type !== 'method_not_found').length === 0) {
          await finalizeEventIfDone(adminClient, event.id, updates.filter(u => u.eventId === event.id).length)
          return { updates, errors }
        }
      }
    } catch (err) {
      console.error(`ESPN Tier 1 failed for event ${event.id}:`, err)
      errors.push({ eventId: event.id, type: 'espn_fetch_error', detail: String(err) })
      // Fall through to Tier 2
    }
  }

  // ── Tier 2: UFC CloudFront API ────────────────────────────────────────────────
  if (!event.ufc_event_fmid) {
    errors.push({ eventId: event.id, type: 'ufc_no_fmid', detail: 'ufc_event_fmid not populated — skipping Tier 2' })
  } else {
    try {
      const ufcFights = await fetchUfcLiveEvent(event.ufc_event_fmid)

      if (!ufcFights) {
        await adminClient.from('api_sync_log').insert({
          sync_type: 'live_results',
          event_id: event.id,
          api_source: 'ufc_api',
          status: 'error',
          request_count: 1,
          details: { type: 'empty_response', fmid: event.ufc_event_fmid },
        })
        errors.push({ eventId: event.id, type: 'ufc_empty_response', detail: `fmid ${event.ufc_event_fmid} returned empty` })
      } else {
        const { data: pendingFights } = await adminClient
          .from('fights')
          .select('id, red_name, blue_name, ufc_fight_id, status, result_winner')
          .eq('event_id', event.id)
          .is('result_winner', null)
          .neq('status', 'final')
          .neq('status', 'cancelled')

        let tier2Updates = 0

        for (const dbFight of pendingFights ?? []) {
          const ufcRaw = ufcFights.find(f => f.fightId === dbFight.ufc_fight_id)
            ?? ufcFights.find(f => alignUfcFight(f, dbFight.red_name, dbFight.blue_name))
          const ufcAligned = ufcRaw ? alignUfcFight(ufcRaw, dbFight.red_name, dbFight.blue_name) : null
          const result = ufcAligned ? ufcResult(ufcAligned) : null
          if (!result) continue

          const error = await writeResult(adminClient, dbFight.id, result, 'ufc_api')
          if (!error) {
            updates.push({ eventId: event.id, fightId: dbFight.id, ...result, tier: 'ufc_api' })
            tier2Updates++
          }
        }

        await adminClient.from('api_sync_log').insert({
          sync_type: 'live_results',
          event_id: event.id,
          api_source: 'ufc_api',
          status: 'success',
          request_count: 1,
          details: { resultsApplied: tier2Updates },
        })

        await finalizeEventIfDone(adminClient, event.id, tier2Updates)
        return { updates, errors }
      }
    } catch (err) {
      console.error(`UFC Tier 2 failed for event ${event.id}:`, err)
      errors.push({ eventId: event.id, type: 'ufc_fetch_error', detail: String(err) })
      // Fall through to Tier 3
    }
  }

  // ── Tier 3: Claude web_search ─────────────────────────────────────────────────
  // Rate-limit: max one call per event per 3 minutes
  const { data: recentClaudeLog } = await adminClient
    .from('api_sync_log')
    .select('id')
    .eq('sync_type', 'live_results')
    .eq('event_id', event.id)
    .eq('api_source', 'claude')
    .gte('created_at', new Date(Date.now() - 3 * 60 * 1000).toISOString())
    .limit(1)

  if (recentClaudeLog && recentClaudeLog.length > 0) {
    return { updates, errors } // Too soon — skip Claude this cycle
  }

  const { data: pendingForClaude } = await adminClient
    .from('fights')
    .select('id, red_name, blue_name')
    .eq('event_id', event.id)
    .is('result_winner', null)
    .neq('status', 'final')
    .neq('status', 'cancelled')

  if (!pendingForClaude || pendingForClaude.length === 0) {
    return { updates, errors }
  }

  try {
    const claudeResults = await fetchFightResultsWithClaude(
      event.name,
      pendingForClaude.map(f => ({ id: f.id, redName: f.red_name, blueName: f.blue_name }))
    )

    let tier3Updates = 0
    const lowConfidence: typeof claudeResults = []

    for (const result of claudeResults) {
      if (result.confidence !== 'high' || !result.winner || !result.method) {
        if (result.confidence === 'low') lowConfidence.push(result)
        continue
      }

      const round = (result.method === 'ko_tko' || result.method === 'submission')
        ? (result.round ?? null)
        : null

      const error = await writeResult(
        adminClient,
        result.fightId,
        { winner: result.winner, method: result.method, round },
        'claude'
      )

      if (!error) {
        updates.push({ eventId: event.id, fightId: result.fightId, winner: result.winner, method: result.method, round, tier: 'claude' })
        tier3Updates++
      }
    }

    await adminClient.from('api_sync_log').insert({
      sync_type: 'live_results',
      event_id: event.id,
      api_source: 'claude',
      status: tier3Updates > 0 ? 'success' : lowConfidence.length > 0 ? 'warning' : 'partial',
      request_count: 1,
      details: {
        resultsApplied: tier3Updates,
        lowConfidence: lowConfidence.length > 0 ? lowConfidence : undefined,
      } as unknown as Json,
    })

    await finalizeEventIfDone(adminClient, event.id, tier3Updates)
  } catch (err) {
    console.error(`Claude Tier 3 failed for event ${event.id}:`, err)
    errors.push({ eventId: event.id, type: 'claude_fetch_error', detail: String(err) })
  }

  return { updates, errors }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Write a final result, recording which feed it came from. Returns an error message or null. */
async function writeResult(
  adminClient: ReturnType<typeof createAdminClient>,
  fightId: string,
  result: FightResult,
  source: 'espn' | 'ufc_api' | 'claude'
): Promise<string | null> {
  const { error } = await adminClient.from('fights').update({
    result_winner: result.winner,
    result_method: result.method,
    result_round: result.round,
    result_source: source,
    status: 'final',
  }).eq('id', fightId)
  return error?.message ?? null
}

async function isEspnHealthy(adminClient: ReturnType<typeof createAdminClient>): Promise<boolean> {
  try {
    const { data } = await adminClient
      .from('espn_health')
      .select('consecutive_failures')
      .eq('endpoint', 'event')
      .single()
    return !data || data.consecutive_failures < 1
  } catch {
    return true // assume healthy if we can't check
  }
}

async function finalizeEventIfDone(
  adminClient: ReturnType<typeof createAdminClient>,
  eventId: string,
  newResults: number
) {
  if (newResults === 0) return

  await adminClient.rpc('recalculate_event_picks', { p_event_id: eventId }).then(({ error }) => {
    if (error) console.error(`recalculate_event_picks failed for ${eventId}:`, error)
  })

  const { data: allFights } = await adminClient
    .from('fights')
    .select('status')
    .eq('event_id', eventId)

  const TERMINAL = ['final', 'cancelled', 'no_contest']
  const allDone = allFights && allFights.length > 0 && allFights.every(f => TERMINAL.includes(f.status))
  if (allDone) {
    await adminClient.from('events').update({ status: 'completed' }).eq('id', eventId)
  }
}

async function logOncePerHour(
  adminClient: ReturnType<typeof createAdminClient>,
  syncType: string,
  eventId: string,
  status: string,
  details: Record<string, unknown>,
) {
  try {
    const { data: recentLog } = await adminClient
      .from('api_sync_log')
      .select('id')
      .eq('sync_type', syncType as 'live_results')
      .eq('event_id', eventId)
      .eq('status', status as 'error')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString())
      .limit(1)

    if (!recentLog || recentLog.length === 0) {
      await adminClient.from('api_sync_log').insert({
        sync_type: syncType as 'live_results',
        event_id: eventId,
        api_source: 'espn',
        status: status as 'error',
        request_count: 0,
        details: details as unknown as Json,
      })
    }
  } catch {
    // Logging is best-effort
  }
}

async function detectStuckEvents(adminClient: ReturnType<typeof createAdminClient>) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: stuckEvents } = await adminClient
      .from('events')
      .select('id, name, start_time')
      .eq('status', 'live')
      .lt('start_time', twentyFourHoursAgo)

    if (stuckEvents && stuckEvents.length > 0) {
      const { data: recentLog } = await adminClient
        .from('api_sync_log')
        .select('id')
        .eq('sync_type', 'health_check')
        .eq('status', 'warning')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        .limit(1)

      if (!recentLog || recentLog.length === 0) {
        await adminClient.from('api_sync_log').insert({
          sync_type: 'health_check',
          api_source: 'espn',
          status: 'warning',
          request_count: 0,
          details: {
            type: 'stuck_events',
            events: stuckEvents.map(e => ({ id: e.id, name: e.name, start_time: e.start_time })),
          },
        })
      }
    }
  } catch {
    // Stuck event detection is best-effort
  }
}
