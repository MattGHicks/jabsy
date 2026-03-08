import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchEventById, getCorners } from '@/lib/api/espn'
import { mapEspnEvent, toFightInsert } from '@/lib/api/sync'

export const dynamic = 'force-dynamic'

/**
 * Daily fight card sync cron job.
 * Runs at 6 AM ET (11:00 UTC) to check for fight card changes on upcoming events.
 * Protected with CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const results: { eventId: string; name: string; added: number; updated: number; cancelled: number }[] = []

  try {
    // Find events that need syncing
    const { data: events } = await adminClient
      .from('events')
      .select('id, name, espn_event_id, start_time')
      .eq('status', 'upcoming')
      .eq('auto_sync_enabled', true)
      .not('espn_event_id', 'is', null)

    if (!events || events.length === 0) {
      return NextResponse.json({ message: 'No events to sync', results: [] })
    }

    for (const event of events) {
      const changes = { added: 0, updated: 0, cancelled: 0 }

      try {
        const espnEvent = await fetchEventById(event.espn_event_id!)
        if (!espnEvent) continue

        const mapped = mapEspnEvent(espnEvent, new Set())

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

        // Update event sync time
        await adminClient
          .from('events')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', event.id)

        results.push({ eventId: event.id, name: event.name, ...changes })
      } catch (err) {
        console.error(`Sync failed for event ${event.id}:`, err)
      }
    }

    // Log
    await adminClient.from('api_sync_log').insert({
      sync_type: 'card_update',
      api_source: 'espn',
      status: results.length > 0 ? 'success' : 'partial',
      request_count: events.length,
      details: { results },
    })

    return NextResponse.json({ message: 'Sync complete', results })
  } catch (err) {
    console.error('Card sync cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
