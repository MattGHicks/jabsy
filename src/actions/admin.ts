'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Treat a datetime-local string (YYYY-MM-DDTHH:MM, no tz info) as Eastern Time
 * and return a proper UTC ISO string for storage in Postgres.
 */
function easternToUTC(localStr: string): string {
  if (!localStr) return localStr
  // Parse as if UTC to get a Date object for offset lookup
  const tempDate = new Date(localStr + ':00Z')
  // Find the ET offset by comparing UTC vs ET representation of tempDate
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(tempDate).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value
    return acc
  }, {})
  const etAsUTC = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`
  )
  // offsetMs: how many ms ahead UTC is of ET (e.g. +14400000 for EDT UTC-4)
  const offsetMs = tempDate.getTime() - etAsUTC.getTime()
  return new Date(tempDate.getTime() + offsetMs).toISOString()
}

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

export async function createEvent(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const name = (formData.get('name') as string)?.trim()
  const start_time = formData.get('start_time') as string
  const venue = (formData.get('venue') as string)?.trim() || null
  const status = ((formData.get('status') as string) || 'upcoming') as 'upcoming' | 'live' | 'completed' | 'cancelled'

  if (!name || !start_time) redirect('/admin/events/new?error=Name+and+date+are+required')

  const start_time_utc = easternToUTC(start_time)

  const { data, error } = await supabase
    .from('events')
    .insert({ name, start_time: start_time_utc, lock_time: start_time_utc, venue, status, created_by: user.id })
    .select('id')
    .single()

  if (error) redirect(`/admin/events/new?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin')
  redirect(`/admin/events/${data.id}`)
}

export async function updateEvent(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const start_time = formData.get('start_time') as string
  const venue = (formData.get('venue') as string)?.trim() || null
  const status = formData.get('status') as 'upcoming' | 'live' | 'completed' | 'cancelled'

  const start_time_utc = easternToUTC(start_time)

  const { error } = await supabase
    .from('events')
    .update({ name, start_time: start_time_utc, lock_time: start_time_utc, venue, status })
    .eq('id', id)

  if (error) redirect(`/admin/events/${id}/edit?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin')
  revalidatePath(`/admin/events/${id}`)
  redirect(`/admin/events/${id}`)
}

export async function deleteEvent(id: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('events').delete().eq('id', id)
  revalidatePath('/admin')
  redirect('/admin')
}

export async function createFight(formData: FormData) {
  const { supabase } = await requireAdmin()

  const event_id = formData.get('event_id') as string
  const red_name = (formData.get('red_name') as string)?.trim()
  const blue_name = (formData.get('blue_name') as string)?.trim()
  const scheduled_rounds = parseInt(formData.get('scheduled_rounds') as string) || 3
  const bout_order = parseInt(formData.get('bout_order') as string) || 1
  const is_main_event = formData.get('is_main_event') === 'on'
  const red_record = (formData.get('red_record') as string)?.trim() || null
  const blue_record = (formData.get('blue_record') as string)?.trim() || null
  const red_sherdog_url = (formData.get('red_sherdog_url') as string)?.trim() || null
  const blue_sherdog_url = (formData.get('blue_sherdog_url') as string)?.trim() || null

  if (!red_name || !blue_name) redirect(`/admin/events/${event_id}?error=Fighter+names+required`)

  const { error } = await supabase.from('fights').insert({
    event_id,
    red_name,
    blue_name,
    scheduled_rounds,
    bout_order,
    is_main_event,
    red_record,
    blue_record,
    red_sherdog_url,
    blue_sherdog_url,
  })

  if (error) redirect(`/admin/events/${event_id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath(`/admin/events/${event_id}`)
  redirect(`/admin/events/${event_id}`)
}

export async function updateFight(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = formData.get('id') as string
  const event_id = formData.get('event_id') as string
  const red_name = (formData.get('red_name') as string)?.trim()
  const blue_name = (formData.get('blue_name') as string)?.trim()
  const scheduled_rounds = parseInt(formData.get('scheduled_rounds') as string) || 3
  const bout_order = parseInt(formData.get('bout_order') as string) || 1
  const is_main_event = formData.get('is_main_event') === 'on'
  const red_record = (formData.get('red_record') as string)?.trim() || null
  const blue_record = (formData.get('blue_record') as string)?.trim() || null
  const red_sherdog_url = (formData.get('red_sherdog_url') as string)?.trim() || null
  const blue_sherdog_url = (formData.get('blue_sherdog_url') as string)?.trim() || null

  const { error } = await supabase
    .from('fights')
    .update({ red_name, blue_name, scheduled_rounds, bout_order, is_main_event, red_record, blue_record, red_sherdog_url, blue_sherdog_url })
    .eq('id', id)

  if (error) redirect(`/admin/events/${event_id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath(`/admin/events/${event_id}`)
  redirect(`/admin/events/${event_id}`)
}

export async function deleteFight(fightId: string, eventId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('fights').delete().eq('id', fightId)
  revalidatePath(`/admin/events/${eventId}`)
  redirect(`/admin/events/${eventId}`)
}

export async function saveResult(data: {
  fight_id: string
  event_id: string
  result_winner: string
  result_method: string
  result_round: number | null
}): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('fights')
    .update({
      result_winner: data.result_winner as 'red' | 'blue' | 'draw' | 'nc',
      result_method: data.result_method as 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc',
      result_round: data.result_round,
      status: 'final' as const,
    })
    .eq('id', data.fight_id)

  if (error) return { success: false, error: error.message }

  const adminClient = createAdminClient()
  await adminClient.rpc('recalculate_event_picks', { p_event_id: data.event_id })

  // Auto-complete event if all fights are now final/cancelled/no_contest
  const { data: allFights } = await adminClient
    .from('fights')
    .select('status')
    .eq('event_id', data.event_id)

  const TERMINAL_STATUSES = ['final', 'cancelled', 'no_contest']
  const allDone =
    allFights &&
    allFights.length > 0 &&
    allFights.every((f) => TERMINAL_STATUSES.includes(f.status))

  if (allDone) {
    await adminClient
      .from('events')
      .update({ status: 'completed' })
      .eq('id', data.event_id)
  }

  revalidatePath('/leagues', 'layout')

  return { success: true }
}

export async function reorderFights(eventId: string, orderedIds: string[]): Promise<void> {
  const { supabase } = await requireAdmin()
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('fights').update({ bout_order: index + 1 }).eq('id', id)
    )
  )
  revalidatePath(`/admin/events/${eventId}`)
}

export async function setFightStatus(fightId: string, status: 'scheduled' | 'live' | 'final' | 'cancelled' | 'no_contest', eventId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('fights').update({ status }).eq('id', fightId)
  revalidatePath(`/admin/events/${eventId}`)
}

export async function setEventStatus(eventId: string, status: 'upcoming' | 'live' | 'completed' | 'cancelled') {
  const { supabase } = await requireAdmin()
  await supabase.from('events').update({ status }).eq('id', eventId)
  revalidatePath('/admin')
  revalidatePath(`/admin/events/${eventId}`)
}
