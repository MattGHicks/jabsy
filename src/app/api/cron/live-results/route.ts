import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchEventById, getCorners, getResultMethod, mapFightStatus } from '@/lib/api/espn'
import type { Json } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * Live results polling cron job.
 * Runs every 60 seconds to check for fight results on live events.
 * Auto-transitions events from upcoming → live when lock_time passes.
 * Logs errors/warnings to api_sync_log instead of failing silently.
 * Detects stuck events (live > 24h).
 * Protected with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
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
      .select('id, name, espn_event_id, start_time')
      .eq('status', 'live')
      .not('espn_event_id', 'is', null)

    if (!liveEvents || liveEvents.length === 0) {
      // Detect stuck events even when no ESPN-linked live events
      await detectStuckEvents(adminClient)
      return NextResponse.json({ message: 'No live events' })
    }

    const updates: { eventId: string; fightId: string; winner: string; method: string; round: number | null }[] = []
    const errors: { eventId: string; type: string; detail: string }[] = []

    for (const event of liveEvents) {
      try {
        const espnEvent = await fetchEventById(event.espn_event_id!)
        if (!espnEvent) {
          errors.push({ eventId: event.id, type: 'event_not_found', detail: `ESPN event ${event.espn_event_id} not found` })
          continue
        }

        // Get existing fights for this event
        const { data: existingFights } = await adminClient
          .from('fights')
          .select('id, espn_competition_id, status, result_winner')
          .eq('event_id', event.id)

        const fightsByEspnId = new Map(
          (existingFights ?? [])
            .filter(f => f.espn_competition_id)
            .map(f => [f.espn_competition_id!, f])
        )

        for (const comp of espnEvent.competitions) {
          const dbFight = fightsByEspnId.get(comp.id)
          if (!dbFight) continue

          // Skip fights that already have results
          if (dbFight.status === 'final' || dbFight.result_winner) continue

          // Check ESPN status
          const espnStatus = mapFightStatus(comp.status)

          // Update fight to live if ESPN says it's in progress
          if (espnStatus === 'live' && dbFight.status === 'scheduled') {
            await adminClient
              .from('fights')
              .update({ status: 'live' })
              .eq('id', dbFight.id)
          }

          // Check for result
          if (!comp.status.type.completed) continue

          // Extract corners with validation
          const cornersResult = getCorners(comp)
          if (!cornersResult.data) {
            // Log corners extraction failure (deduplicate: once per hour)
            await logOncePerHour(adminClient, 'live_results', event.id, 'error', {
              type: 'corners_extraction_failed',
              fight_id: dbFight.id,
              competition_id: comp.id,
              warnings: cornersResult.warnings,
            })
            errors.push({ eventId: event.id, type: 'corners_failed', detail: `Competition ${comp.id}` })
            continue
          }

          // Extract method with validation
          const methodResult = getResultMethod(comp)

          // Log warnings from method extraction (deduplicate)
          if (methodResult.warnings.length > 0) {
            await logOncePerHour(adminClient, 'live_results', event.id, 'warning', {
              fight_id: dbFight.id,
              competition_id: comp.id,
              warnings: methodResult.warnings,
            })
          }

          if (!methodResult.data) {
            await logOncePerHour(adminClient, 'live_results', event.id, 'error', {
              type: 'result_extraction_failed',
              fight_id: dbFight.id,
              competition_id: comp.id,
              espn_status: comp.status,
              details_array: comp.details,
            })
            errors.push({ eventId: event.id, type: 'method_not_found', detail: `Competition ${comp.id}` })
            continue
          }

          const corners = cornersResult.data
          let winner: 'red' | 'blue' | 'draw' | 'nc' = 'draw'
          if (corners.red.winner) winner = 'red'
          else if (corners.blue.winner) winner = 'blue'

          const round = (methodResult.data === 'ko_tko' || methodResult.data === 'submission')
            ? comp.status.period
            : null

          // Apply result
          const { error } = await adminClient
            .from('fights')
            .update({
              result_winner: winner,
              result_method: methodResult.data,
              result_round: round,
              status: 'final',
            })
            .eq('id', dbFight.id)

          if (!error) {
            updates.push({
              eventId: event.id,
              fightId: dbFight.id,
              winner,
              method: methodResult.data,
              round,
            })
          } else {
            errors.push({ eventId: event.id, type: 'update_failed', detail: error.message })
          }
        }

        // Recalculate picks if any results were applied for this event
        const eventUpdates = updates.filter(u => u.eventId === event.id)
        if (eventUpdates.length > 0) {
          const { error: rpcError } = await adminClient.rpc('recalculate_event_picks', { p_event_id: event.id })
          if (rpcError) {
            await adminClient.from('api_sync_log').insert({
              sync_type: 'live_results',
              event_id: event.id,
              api_source: 'espn',
              status: 'error',
              request_count: 0,
              details: { type: 'recalculate_failed', error: rpcError.message },
            })
          }

          // Check if all fights are done
          const { data: allFights } = await adminClient
            .from('fights')
            .select('status')
            .eq('event_id', event.id)

          const TERMINAL = ['final', 'cancelled', 'no_contest']
          const allDone = allFights && allFights.length > 0 && allFights.every(f => TERMINAL.includes(f.status))

          if (allDone) {
            await adminClient
              .from('events')
              .update({ status: 'completed' })
              .eq('id', event.id)
          }
        }
      } catch (err) {
        console.error(`Live results fetch failed for event ${event.id}:`, err)
        errors.push({ eventId: event.id, type: 'fetch_error', detail: String(err) })
      }
    }

    // Log if there were updates or errors
    if (updates.length > 0 || errors.length > 0) {
      await adminClient.from('api_sync_log').insert({
        sync_type: 'live_results',
        api_source: 'espn',
        status: errors.length > 0 ? (updates.length > 0 ? 'partial' : 'error') : 'success',
        request_count: liveEvents.length,
        details: { updates, errors: errors.length > 0 ? errors : undefined },
      })
    }

    // Detect stuck events
    await detectStuckEvents(adminClient)

    return NextResponse.json({
      message: `Polled ${liveEvents.length} live events`,
      resultsApplied: updates.length,
      updates,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('Live results cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

/**
 * Log a sync entry at most once per hour to avoid flooding the log table
 * from 60-second polling intervals.
 */
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

/**
 * Detect events stuck in 'live' status for more than 24 hours.
 * Logs a warning to api_sync_log (max once per hour).
 */
async function detectStuckEvents(adminClient: ReturnType<typeof createAdminClient>) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: stuckEvents } = await adminClient
      .from('events')
      .select('id, name, start_time')
      .eq('status', 'live')
      .lt('start_time', twentyFourHoursAgo)

    if (stuckEvents && stuckEvents.length > 0) {
      // Deduplicate: only log once per hour
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
