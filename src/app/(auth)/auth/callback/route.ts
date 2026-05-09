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
        const pendingInviteFromUrl = url.searchParams.get('pending_invite')
        const pendingInvite = pendingInviteFromUrl || cookieStore.get('pending_invite')?.value
        const eventFromUrl = url.searchParams.get('event')
        const pendingEvent = eventFromUrl || cookieStore.get('pending_invite_event')?.value

        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single()

        const needsOnboarding = !profile?.username

        if (pendingInvite) cookieStore.delete('pending_invite')
        if (pendingEvent) cookieStore.delete('pending_invite_event')

        const eventQs = pendingEvent ? `&event=${encodeURIComponent(pendingEvent)}` : ''

        if (needsOnboarding) {
          const onboardingUrl = pendingInvite
            ? `/onboarding?pending_invite=${pendingInvite}${eventQs}`
            : '/onboarding'
          return NextResponse.redirect(new URL(onboardingUrl, url.origin))
        }

        if (pendingInvite) {
          const inviteUrl = pendingEvent
            ? `/invite/${pendingInvite}?event=${encodeURIComponent(pendingEvent)}`
            : `/invite/${pendingInvite}`
          return NextResponse.redirect(new URL(inviteUrl, url.origin))
        }

        return NextResponse.redirect(new URL(next, url.origin))
      }
    }
  }

  return NextResponse.redirect(new URL('/login?error=Auth+callback+failed', url.origin))
}
