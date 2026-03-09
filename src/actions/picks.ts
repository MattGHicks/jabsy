'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function savePick(formData: FormData): Promise<{ error?: string } | void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fight_id = formData.get('fight_id') as string
  const league_id = formData.get('league_id') as string
  const event_id = formData.get('event_id') as string
  const pick_winner = formData.get('pick_winner') as string
  const pick_method = formData.get('pick_method') as string
  const pick_round_raw = formData.get('pick_round') as string
  const pick_round = pick_round_raw ? parseInt(pick_round_raw) : null

  if (!fight_id || !league_id || !event_id || !pick_winner || !pick_method) return

  // Verify the event is still open for picks
  const { data: event } = await supabase
    .from('events')
    .select('status, lock_time')
    .eq('id', event_id)
    .single()

  if (!event || event.status !== 'upcoming') return { error: 'Picks are locked for this event.' }
  if (event.lock_time && new Date() >= new Date(event.lock_time)) return { error: 'Picks are locked for this event.' }

  // Verify user is a member of this league
  const { data: membership } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', league_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return { error: 'You are not a member of this league.' }

  // Verify fight exists in this event and is not cancelled
  const { data: fight } = await supabase
    .from('fights')
    .select('id, status')
    .eq('id', fight_id)
    .eq('event_id', event_id)
    .single()

  if (!fight) return { error: 'Fight not found in this event.' }
  if (fight.status === 'cancelled') return { error: 'This fight has been cancelled.' }

  // Upsert pick
  const { error } = await supabase.from('picks').upsert(
    {
      user_id: user.id,
      fight_id,
      league_id,
      event_id,
      pick_winner: pick_winner as 'red' | 'blue',
      pick_method: pick_method as 'decision' | 'ko_tko' | 'submission',
      pick_round,
    },
    { onConflict: 'user_id,league_id,fight_id' }
  )

  if (error) return { error: error.message }

  revalidatePath(`/leagues/${league_id}/events/${event_id}`)
}

export async function clearAllPicks(leagueId: string, eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify the event is still open for picks
  const { data: event } = await supabase
    .from('events')
    .select('status, lock_time')
    .eq('id', eventId)
    .single()

  if (!event || event.status !== 'upcoming') return
  if (event.lock_time && new Date() >= new Date(event.lock_time)) return

  // Delete all picks for this user in this league/event
  await supabase
    .from('picks')
    .delete()
    .eq('user_id', user.id)
    .eq('league_id', leagueId)
    .eq('event_id', eventId)

  revalidatePath(`/leagues/${leagueId}/events/${eventId}`)
}
