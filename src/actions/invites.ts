'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { generateInviteCode } from '@/lib/utils'

export async function createInvite(leagueId: string, maxUses = 100, expiresAt?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify ownership
  const { data: league } = await supabase
    .from('leagues')
    .select('owner_id')
    .eq('id', leagueId)
    .single()

  if (league?.owner_id !== user.id) return { error: 'Not authorized' }

  // Generate unique code
  let code = generateInviteCode()
  let attempts = 0
  while (attempts < 5) {
    const { data: existing } = await supabase
      .from('invites')
      .select('id')
      .eq('code', code)
      .single()
    if (!existing) break
    code = generateInviteCode()
    attempts++
  }

  const { data, error } = await supabase
    .from('invites')
    .insert({
      code,
      league_id: leagueId,
      created_by: user.id,
      max_uses: maxUses,
      expires_at: expiresAt || null,
    })
    .select('code')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/leagues/${leagueId}/settings`)
  return { code: data.code }
}

export async function deleteInvite(inviteId: string, leagueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('invites').delete().eq('id', inviteId).eq('created_by', user.id)

  revalidatePath(`/leagues/${leagueId}/settings`)
}

export async function joinViaInvite(code: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/invite/${code}`)

  // Look up the invite
  const { data: invite } = await supabase
    .from('invites')
    .select('*, leagues(id, name)')
    .eq('code', code)
    .single()

  if (!invite) return { error: 'Invalid invite code' }

  // Check expiry
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { error: 'This invite has expired' }
  }

  // Check max uses
  if (invite.use_count >= invite.max_uses) {
    return { error: 'This invite has reached its maximum uses' }
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', invite.league_id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    return { leagueId: invite.league_id, alreadyMember: true }
  }

  // Add as member
  const { error } = await supabase.from('league_members').insert({
    league_id: invite.league_id,
    user_id: user.id,
    role: 'member',
  })

  if (error) return { error: error.message }

  // Increment use count
  await supabase
    .from('invites')
    .update({ use_count: invite.use_count + 1 })
    .eq('id', invite.id)

  revalidatePath('/dashboard')
  return { leagueId: invite.league_id }
}
