import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const pendingInvite = url.searchParams.get('pending_invite')

  // If an invite code was passed via URL, store it in a cookie so it
  // survives the round-trip through Google OAuth and back to /auth/callback
  if (pendingInvite) {
    const cookieStore = await cookies()
    cookieStore.set('pending_invite', pendingInvite, {
      path: '/',
      maxAge: 60 * 60,
      httpOnly: true,
      sameSite: 'lax',
    })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error || !data.url) {
    return NextResponse.redirect(
      new URL('/login?error=Google+sign-in+failed', process.env.NEXT_PUBLIC_APP_URL)
    )
  }

  return NextResponse.redirect(data.url)
}
