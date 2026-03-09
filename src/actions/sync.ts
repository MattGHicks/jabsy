'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchCalendar, fetchEventById, extractEventId } from '@/lib/api/espn'
import { mapEspnEvent, toEventInsert, toFightInsert } from '@/lib/api/sync'
import { searchUpcomingUFCEvents, lookupSherdogUrls } from '@/lib/api/claude-search'
import type { MappedEvent, MappedFight } from '@/lib/api/types'
import type { Json } from '@/types/database'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')
  return { supabase, user }
}

/**
 * Search for upcoming UFC events using Claude AI + ESPN data.
 * Returns events not already imported.
 */
export async function searchForEvents(): Promise<{
  events: MappedEvent[]
  source: 'espn' | 'claude' | 'both'
  error?: string
}> {
  await requireAdmin()

  const adminClient = createAdminClient()

  // Get already-imported ESPN event IDs
  const { data: existingEvents } = await adminClient
    .from('events')
    .select('espn_event_id')
    .not('espn_event_id', 'is', null)

  const importedIds = new Set(
    (existingEvents ?? []).map(e => e.espn_event_id).filter(Boolean) as string[]
  )

  try {
    // Strategy: Use ESPN calendar for structured data, Claude for discovery
    const calResult = await fetchCalendar()
    const calendar = calResult.data

    // Filter to future events only
    const now = new Date()
    const futureEntries = calendar.filter(entry => new Date(entry.startDate) > now)

    // Fetch fight card details for each upcoming event (limit to next 8)
    const events: MappedEvent[] = []
    const entriesToFetch = futureEntries.slice(0, 8)

    for (const entry of entriesToFetch) {
      const espnEventId = extractEventId(entry)
      if (!espnEventId) continue

      try {
        const espnEvent = await fetchEventById(espnEventId)
        if (espnEvent) {
          events.push(mapEspnEvent(espnEvent, importedIds).data)
        } else {
          // Fallback: create a basic event from calendar data
          events.push({
            espnEventId,
            name: entry.label,
            shortName: entry.label,
            startTime: entry.startDate,
            venue: null,
            fightCount: 0,
            fights: [],
            alreadyImported: importedIds.has(espnEventId),
          })
        }
      } catch (err) {
        // If individual event fetch fails, add basic info from calendar
        events.push({
          espnEventId,
          name: entry.label,
          shortName: entry.label,
          startTime: entry.startDate,
          venue: null,
          fightCount: 0,
          fights: [],
          alreadyImported: importedIds.has(espnEventId),
        })
        console.error(`Failed to fetch event ${espnEventId}:`, err)
      }
    }

    return { events, source: 'espn' }
  } catch (espnError) {
    console.error('ESPN fetch failed, falling back to Claude:', espnError)

    // Fallback: use Claude AI to search for events
    try {
      const claudeEvents = await searchUpcomingUFCEvents()
      const mapped: MappedEvent[] = claudeEvents.map((e, i) => ({
        espnEventId: `claude-${i}`,
        name: e.name,
        shortName: e.name,
        startTime: new Date(e.date).toISOString(),
        venue: e.venue,
        fightCount: e.fightCount ?? e.fights?.length ?? 0,
        fights: (e.fights ?? []).map((f, j): MappedFight => ({
          espnCompetitionId: `claude-${i}-${j}`,
          redName: f.red,
          redRecord: null,
          blueName: f.blue,
          blueRecord: null,
          weightClass: f.weightClass ?? null,
          scheduledRounds: 3,
          isMainEvent: j === 0,
          boutOrder: (e.fights?.length ?? 0) - j,
          status: 'scheduled',
        })),
        alreadyImported: false,
      }))
      return { events: mapped, source: 'claude' }
    } catch (claudeError) {
      console.error('Claude search also failed:', claudeError)
      return { events: [], source: 'espn', error: 'Failed to fetch events from both ESPN and Claude AI' }
    }
  }
}

/**
 * Preview the fight card for a specific ESPN event.
 */
export async function previewEventCard(espnEventId: string): Promise<{
  event: MappedEvent | null
  error?: string
}> {
  await requireAdmin()

  try {
    const espnEvent = await fetchEventById(espnEventId)
    if (!espnEvent) return { event: null, error: 'Event not found on ESPN' }

    const mapped = mapEspnEvent(espnEvent, new Set()).data
    return { event: mapped }
  } catch (err) {
    return { event: null, error: `Failed to fetch event: ${err}` }
  }
}

/**
 * Import an ESPN event into the database with all its fights.
 */
export async function importEvent(espnEventId: string): Promise<{
  success: boolean
  eventId?: string
  error?: string
}> {
  const { user } = await requireAdmin()
  const adminClient = createAdminClient()

  // Check if already imported
  const { data: existing } = await adminClient
    .from('events')
    .select('id')
    .eq('espn_event_id', espnEventId)
    .single()

  if (existing) {
    return { success: false, error: 'Event already imported' }
  }

  try {
    // Fetch event from ESPN
    const espnEvent = await fetchEventById(espnEventId)
    if (!espnEvent) return { success: false, error: 'Event not found on ESPN' }

    const mappedResult = mapEspnEvent(espnEvent, new Set())
    const mapped = mappedResult.data

    // Insert event
    const eventInsert = toEventInsert(mapped, user.id)
    const { data: newEvent, error: eventError } = await adminClient
      .from('events')
      .insert(eventInsert)
      .select('id')
      .single()

    if (eventError || !newEvent) {
      return { success: false, error: eventError?.message ?? 'Failed to create event' }
    }

    // Insert all fights
    const fightInserts = mapped.fights.map(f => toFightInsert(f, newEvent.id))
    if (fightInserts.length > 0) {
      const { error: fightsError } = await adminClient
        .from('fights')
        .insert(fightInserts)

      if (fightsError) {
        // Rollback event if fights fail
        await adminClient.from('events').delete().eq('id', newEvent.id)
        return { success: false, error: `Failed to create fights: ${fightsError.message}` }
      }
    }

    // Look up exact Sherdog profile URLs (best-effort, non-blocking)
    try {
      const allFighterNames = mapped.fights.flatMap(f => [f.redName, f.blueName])
      const { results: sherdogUrls } = await lookupSherdogUrls(allFighterNames)

      if (Object.keys(sherdogUrls).length > 0) {
        // Batch update fights with exact Sherdog URLs
        for (const fight of mapped.fights) {
          const redUrl = sherdogUrls[fight.redName]
          const blueUrl = sherdogUrls[fight.blueName]
          if (redUrl || blueUrl) {
            const update: Record<string, string> = {}
            if (redUrl) update.red_sherdog_url = redUrl
            if (blueUrl) update.blue_sherdog_url = blueUrl
            await adminClient
              .from('fights')
              .update(update)
              .eq('event_id', newEvent.id)
              .eq('red_name', fight.redName)
              .eq('blue_name', fight.blueName)
          }
        }
      }
    } catch {
      // Sherdog lookup is best-effort — search URL fallback is already in place
    }

    // Log the sync
    await adminClient.from('api_sync_log').insert({
      sync_type: 'event_import',
      event_id: newEvent.id,
      api_source: 'espn',
      status: 'success',
      request_count: 2,
      details: { espn_event_id: espnEventId, fight_count: fightInserts.length },
    })

    revalidatePath('/admin')
    return { success: true, eventId: newEvent.id }
  } catch (err) {
    return { success: false, error: `Import failed: ${err}` }
  }
}

/**
 * Sync fight card for an existing event from ESPN.
 * Updates fighter names/records, adds new fights, flags cancelled ones.
 */
export async function syncFightCard(eventId: string): Promise<{
  success: boolean
  changes: { added: number; updated: number; cancelled: number }
  warningCount: number
  error?: string
}> {
  await requireAdmin()
  const adminClient = createAdminClient()

  const changes = { added: 0, updated: 0, cancelled: 0 }
  let warningCount = 0

  // Get the event's ESPN ID
  const { data: event } = await adminClient
    .from('events')
    .select('espn_event_id')
    .eq('id', eventId)
    .single()

  if (!event?.espn_event_id) {
    return { success: false, changes, warningCount, error: 'Event has no ESPN ID' }
  }

  try {
    const espnEvent = await fetchEventById(event.espn_event_id)
    if (!espnEvent) return { success: false, changes, warningCount, error: 'Event not found on ESPN' }

    const mappedResult = mapEspnEvent(espnEvent, new Set())
    const mapped = mappedResult.data
    warningCount = mappedResult.warnings.length

    // Log validation warnings if any
    if (warningCount > 0) {
      await adminClient.from('api_sync_log').insert({
        sync_type: 'validation',
        event_id: eventId,
        api_source: 'espn',
        status: 'warning',
        request_count: 0,
        details: { warnings: mappedResult.warnings } as unknown as Json,
      })
    }

    // Get existing fights for this event
    const { data: existingFights } = await adminClient
      .from('fights')
      .select('*')
      .eq('event_id', eventId)

    const existingByEspnId = new Map(
      (existingFights ?? [])
        .filter(f => f.espn_competition_id)
        .map(f => [f.espn_competition_id!, f])
    )

    const espnCompIds = new Set(mapped.fights.map(f => f.espnCompetitionId))

    // Update existing fights or add new ones
    for (const fight of mapped.fights) {
      const existing = existingByEspnId.get(fight.espnCompetitionId)

      if (existing) {
        // Skip manually modified fights
        if (existing.sync_status === 'modified') continue

        // Update fighter info
        const { error } = await adminClient
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

        if (!error) changes.updated++
      } else {
        // New fight — add it
        const insert = toFightInsert(fight, eventId)
        const { error } = await adminClient.from('fights').insert(insert)
        if (!error) changes.added++
      }
    }

    // Cancel fights that are no longer on ESPN card
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

    // Update event sync timestamp
    await adminClient
      .from('events')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', eventId)

    // Log
    await adminClient.from('api_sync_log').insert({
      sync_type: 'card_update',
      event_id: eventId,
      api_source: 'espn',
      status: 'success',
      request_count: 2,
      details: changes,
    })

    revalidatePath(`/admin/events/${eventId}`)
    return { success: true, changes, warningCount }
  } catch (err) {
    return { success: false, changes, warningCount, error: `Sync failed: ${err}` }
  }
}

/**
 * Toggle auto-sync for an event.
 */
export async function toggleAutoSync(eventId: string, enabled: boolean): Promise<void> {
  await requireAdmin()
  const adminClient = createAdminClient()

  await adminClient
    .from('events')
    .update({ auto_sync_enabled: enabled })
    .eq('id', eventId)

  revalidatePath(`/admin/events/${eventId}`)
}
