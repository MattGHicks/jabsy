import { createAdminClient } from '@/lib/supabase/admin'

export type NextEventData = {
  id: string
  name: string
  start_time: string
  venue: string | null
  status: 'upcoming' | 'live'
  fightCount: number
  mainEvent: {
    red_name: string
    red_record: string | null
    blue_name: string
    blue_record: string | null
    weight_class: string | null
    scheduled_rounds: number
  } | null
}

/**
 * Soonest upcoming (or currently live) event with its main-event fight, for
 * public surfaces like the landing page. Uses the service-role client because
 * visitors are anonymous; only public card facts are returned. Returns null
 * on any failure so callers can fall back to static content.
 */
export async function getNextUpcomingEvent(): Promise<NextEventData | null> {
  try {
    const supabase = createAdminClient()

    const { data: event } = await supabase
      .from('events')
      .select('id, name, start_time, venue, status')
      .in('status', ['live', 'upcoming'])
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!event) return null

    const { data: fights } = await supabase
      .from('fights')
      .select('red_name, red_record, blue_name, blue_record, weight_class, scheduled_rounds, is_main_event, bout_order')
      .eq('event_id', event.id)
      .neq('status', 'cancelled')
      .order('bout_order', { ascending: true })

    const activeFights = fights ?? []
    const main = activeFights.find(f => f.is_main_event) ?? activeFights[0] ?? null

    return {
      id: event.id,
      name: event.name,
      start_time: event.start_time,
      venue: event.venue,
      status: event.status as 'upcoming' | 'live',
      fightCount: activeFights.length,
      mainEvent: main
        ? {
            red_name: main.red_name,
            red_record: main.red_record,
            blue_name: main.blue_name,
            blue_record: main.blue_record,
            weight_class: main.weight_class,
            scheduled_rounds: main.scheduled_rounds,
          }
        : null,
    }
  } catch {
    return null
  }
}
