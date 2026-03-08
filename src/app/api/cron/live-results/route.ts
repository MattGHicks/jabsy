import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchEventById, getCorners, getResultMethod, mapFightStatus } from '@/lib/api/espn'

export const dynamic = 'force-dynamic'

/**
 * Live results polling cron job.
 * Runs every 60 seconds to check for fight results on live events.
 * Auto-transitions events from upcoming → live when lock_time passes.
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
      .select('id, espn_event_id')
      .eq('status', 'live')
      .not('espn_event_id', 'is', null)

    if (!liveEvents || liveEvents.length === 0) {
      return NextResponse.json({ message: 'No live events' })
    }

    const updates: { eventId: string; fightId: string; winner: string; method: string; round: number | null }[] = []

    for (const event of liveEvents) {
      try {
        const espnEvent = await fetchEventById(event.espn_event_id!)
        if (!espnEvent) continue

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

          const method = getResultMethod(comp)
          if (!method) continue

          const corners = getCorners(comp)
          let winner: 'red' | 'blue' | 'draw' | 'nc' = 'draw'
          if (corners.red.winner) winner = 'red'
          else if (corners.blue.winner) winner = 'blue'

          const round = (method === 'ko_tko' || method === 'submission')
            ? comp.status.period
            : null

          // Apply result
          const { error } = await adminClient
            .from('fights')
            .update({
              result_winner: winner,
              result_method: method,
              result_round: round,
              status: 'final',
            })
            .eq('id', dbFight.id)

          if (!error) {
            updates.push({
              eventId: event.id,
              fightId: dbFight.id,
              winner,
              method,
              round,
            })
          }
        }

        // Recalculate picks if any results were applied for this event
        const eventUpdates = updates.filter(u => u.eventId === event.id)
        if (eventUpdates.length > 0) {
          await adminClient.rpc('recalculate_event_picks', { p_event_id: event.id })

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
      }
    }

    // Log if there were updates
    if (updates.length > 0) {
      await adminClient.from('api_sync_log').insert({
        sync_type: 'live_results',
        api_source: 'espn',
        status: 'success',
        request_count: liveEvents.length,
        details: { updates },
      })
    }

    return NextResponse.json({
      message: `Polled ${liveEvents.length} live events`,
      resultsApplied: updates.length,
      updates,
    })
  } catch (err) {
    console.error('Live results cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
