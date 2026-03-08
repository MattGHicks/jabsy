'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { joinViaInvite } from '@/actions/invites'

export async function loginWithEmail(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const pendingInvite = formData.get('pending_invite') as string | null

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const base = pendingInvite ? `/login?pending_invite=${pendingInvite}&error=` : '/login?error='
    redirect(`${base}${encodeURIComponent(error.message)}`)
  }

  if (pendingInvite) {
    redirect(`/invite/${pendingInvite}`)
  }

  redirect('/dashboard')
}

export async function loginWithGoogle() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect('/login?error=Google+sign-in+failed')
  }

  redirect(data.url)
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirm = formData.get('confirm_password') as string
  const pendingInvite = formData.get('pending_invite') as string | null

  const baseSignupUrl = pendingInvite ? `/signup?pending_invite=${pendingInvite}` : '/signup'

  if (password !== confirm) {
    redirect(`${baseSignupUrl}&error=Passwords+do+not+match`)
  }

  if (password.length < 8) {
    redirect(`${baseSignupUrl}&error=Password+must+be+at+least+8+characters`)
  }

  // Embed pending_invite in the confirmation link so it survives the email click
  const callbackUrl = pendingInvite
    ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?pending_invite=${pendingInvite}`
    : `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl,
    },
  })

  if (error) {
    redirect(`${baseSignupUrl}&error=${encodeURIComponent(error.message)}`)
  }

  // Email not confirmed yet — send to check-email page
  const checkEmailUrl = pendingInvite
    ? `/check-email?email=${encodeURIComponent(email)}&pending_invite=${pendingInvite}`
    : `/check-email?email=${encodeURIComponent(email)}`

  redirect(checkEmailUrl)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'global' })
  redirect('/login')
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const username = (formData.get('username') as string)?.trim()
  const avatarFile = formData.get('avatar') as File | null

  if (!username || username.length < 3 || username.length > 20) {
    redirect('/onboarding?error=Username+must+be+3-20+characters')
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    redirect('/onboarding?error=Username+can+only+contain+letters+numbers+and+underscores')
  }

  let avatarUrl: string | undefined

  // Upload avatar if provided
  if (avatarFile && avatarFile.size > 0) {
    const fileExt = avatarFile.name.split('.').pop()
    const filePath = `${user.id}/avatar.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, { upsert: true })

    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      avatarUrl = urlData.publicUrl
    }
  }

  const updateData: { username: string; avatar_url?: string } = { username }
  if (avatarUrl) updateData.avatar_url = avatarUrl

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') {
      redirect('/onboarding?error=That+username+is+already+taken')
    }
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`)
  }

  // Handle pending league invite — auto-join and go straight to the league
  const pendingInvite = formData.get('pending_invite') as string | null
  if (pendingInvite) {
    const result = await joinViaInvite(pendingInvite)
    if ('leagueId' in result && result.leagueId) {
      redirect(`/leagues/${result.leagueId}`)
    }
    // If join failed for any reason, fall back to the invite page
    redirect(`/invite/${pendingInvite}`)
  }

  redirect('/dashboard')
}

export async function updateProfileSettings(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const username = (formData.get('username') as string)?.trim()
  const avatarFile = formData.get('avatar') as File | null

  if (!username || username.length < 3 || username.length > 30) {
    return { error: 'Username must be 3-30 characters' }
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { error: 'Username can only contain letters, numbers, underscores, and hyphens' }
  }

  let avatarUrl: string | undefined

  if (avatarFile && avatarFile.size > 0) {
    const fileExt = avatarFile.name.split('.').pop()
    const filePath = `${user.id}/avatar.${fileExt}`
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, avatarFile, { upsert: true })
    if (uploadError) {
      return { error: `Avatar upload failed: ${uploadError.message}` }
    }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
    avatarUrl = urlData.publicUrl
  }

  const updateData: { username: string; avatar_url?: string } = { username }
  if (avatarUrl) updateData.avatar_url = avatarUrl

  const { error } = await supabase.from('profiles').update(updateData).eq('id', user.id)
  if (error) {
    if (error.code === '23505') return { error: 'That username is already taken' }
    return { error: error.message }
  }

  return {}
}
