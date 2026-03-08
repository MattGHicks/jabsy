import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const cookieStore = await cookies()
        // Check URL params first (email confirmation flow embeds it in emailRedirectTo)
        // Fall back to cookie (Google OAuth flow sets it before redirecting)
        const pendingInviteFromUrl = url.searchParams.get('pending_invite')
        const pendingInvite = pendingInviteFromUrl || cookieStore.get('pending_invite')?.value

        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()

        const needsOnboarding = !profile?.username

        // Always clear the cookie once we've read it
        if (pendingInvite) cookieStore.delete('pending_invite')

        if (needsOnboarding) {
          const onboardingUrl = pendingInvite
            ? `/onboarding?pending_invite=${pendingInvite}`
            : '/onboarding'
          return NextResponse.redirect(new URL(onboardingUrl, url.origin))
        }

        if (pendingInvite) {
          return NextResponse.redirect(new URL(`/invite/${pendingInvite}`, url.origin))
        }

        return NextResponse.redirect(new URL(next, url.origin))
      }
    }
  }

  return NextResponse.redirect(new URL('/login?error=Auth+callback+failed', url.origin))
}
