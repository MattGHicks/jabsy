'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

export async function createLeague(formData: FormData) {
  const { supabase, user } = await getAuthUser()

  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null

  if (!name) redirect('/leagues/new?error=League+name+is+required')

  // Create the league
  const { data: league, error } = await supabase
    .from('leagues')
    .insert({ name, description, owner_id: user.id })
    .select('id')
    .single()

  if (error) redirect(`/leagues/new?error=${encodeURIComponent(error.message)}`)

  // Add owner as admin member
  await supabase.from('league_members').insert({
    league_id: league.id,
    user_id: user.id,
    role: 'admin',
  })

  // Update role to league_owner if currently 'player'
  await supabase
    .from('profiles')
    .update({ role: 'league_owner' })
    .eq('id', user.id)
    .eq('role', 'player')

  revalidatePath('/dashboard')
  redirect(`/leagues/${league.id}`)
}

export async function updateLeague(formData: FormData) {
  const { supabase, user } = await getAuthUser()

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null

  // Verify ownership
  const { data: league } = await supabase
    .from('leagues')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (league?.owner_id !== user.id) redirect(`/leagues/${id}/settings?error=Not+authorized`)

  const { error } = await supabase
    .from('leagues')
    .update({ name, description })
    .eq('id', id)

  if (error) redirect(`/leagues/${id}/settings?error=${encodeURIComponent(error.message)}`)

  revalidatePath(`/leagues/${id}`)
  revalidatePath(`/leagues/${id}/settings`)
  redirect(`/leagues/${id}/settings`)
}

export async function deleteLeague(id: string) {
  const { supabase, user } = await getAuthUser()

  const { data: league } = await supabase
    .from('leagues')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (league?.owner_id !== user.id) redirect('/dashboard')

  await supabase.from('leagues').delete().eq('id', id)

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function addEventToLeague(leagueId: string, eventId: string) {
  const { supabase, user } = await getAuthUser()

  // Verify ownership
  const { data: league } = await supabase
    .from('leagues')
    .select('owner_id')
    .eq('id', leagueId)
    .single()

  if (league?.owner_id !== user.id) return

  await supabase.from('league_events').insert({
    league_id: leagueId,
    event_id: eventId,
    added_by: user.id,
  })

  revalidatePath(`/leagues/${leagueId}/settings`)
  revalidatePath(`/leagues/${leagueId}`)
}

export async function removeEventFromLeague(leagueId: string, eventId: string) {
  const { supabase, user } = await getAuthUser()

  const { data: league } = await supabase
    .from('leagues')
    .select('owner_id')
    .eq('id', leagueId)
    .single()

  if (league?.owner_id !== user.id) return

  await supabase
    .from('league_events')
    .delete()
    .eq('league_id', leagueId)
    .eq('event_id', eventId)

  revalidatePath(`/leagues/${leagueId}/settings`)
  revalidatePath(`/leagues/${leagueId}`)
}

export async function removeMember(leagueId: string, memberId: string) {
  const { supabase, user } = await getAuthUser()

  const { data: league } = await supabase
    .from('leagues')
    .select('owner_id')
    .eq('id', leagueId)
    .single()

  if (league?.owner_id !== user.id) return

  // Can't remove the owner
  if (memberId === user.id) return

  await supabase
    .from('league_members')
    .delete()
    .eq('league_id', leagueId)
    .eq('user_id', memberId)

  revalidatePath(`/leagues/${leagueId}`)
  revalidatePath(`/leagues/${leagueId}/settings`)
}
