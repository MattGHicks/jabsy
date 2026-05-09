import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { Users, ArrowRight, LogIn, UserPlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { joinViaInvite } from '@/actions/invites'
import { WebViewWarning } from './webview-warning'

interface PageProps {
  params: Promise<{ code: string }>
  searchParams: Promise<{ error?: string; event?: string }>
}

const IN_APP_BROWSER_RE = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Twitter|LinkedInApp/i

type InviteContext = {
  leagueId: string
  leagueName: string
  leagueDescription: string | null
  isExpired: boolean
  isFull: boolean
}

async function lookupInviteContext(supabase: Awaited<ReturnType<typeof createClient>>, code: string): Promise<InviteContext | null> {
  // Try the throwaway invite table first (settings-page-generated codes).
  const { data: invite } = await supabase
    .from('invites')
    .select('use_count, max_uses, expires_at, leagues(id, name, description)')
    .eq('code', code)
    .single()

  if (invite) {
    const league = invite.leagues as { id: string; name: string; description: string | null } | null
    if (!league) return null
    return {
      leagueId: league.id,
      leagueName: league.name,
      leagueDescription: league.description,
      isExpired: !!invite.expires_at && new Date(invite.expires_at) < new Date(),
      isFull: invite.use_count >= invite.max_uses,
    }
  }

  // Fall through to the persistent per-league share code (never expires, no use cap).
  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, description')
    .eq('share_code', code)
    .single()

  if (league) {
    return {
      leagueId: league.id,
      leagueName: league.name,
      leagueDescription: league.description,
      isExpired: false,
      isFull: false,
    }
  }

  return null
}

function buildPostJoinUrl(leagueId: string, eventId: string | null | undefined): string {
  return eventId ? `/leagues/${leagueId}/events/${eventId}` : `/leagues/${leagueId}`
}

export default async function InvitePage({ params, searchParams }: PageProps) {
  const { code } = await params
  const { error: joinError, event: eventParam } = await searchParams
  const supabase = await createClient()

  const headersList = await headers()
  const ua = headersList.get('user-agent') ?? ''
  const isWebView = IN_APP_BROWSER_RE.test(ua)
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://jabsypicks.com'}/invite/${code}${eventParam ? `?event=${eventParam}` : ''}`

  const ctx = await lookupInviteContext(supabase, code)

  if (!ctx) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🥊</p>
          <h1 className="text-[#f4f4f5] mb-2" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '2rem' }}>
            INVALID INVITE
          </h1>
          <p className="text-sm text-[#71717a] mb-6">This invite link is invalid or has expired.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (ctx.isExpired || ctx.isFull) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">⛔</p>
          <h1 className="text-[#f4f4f5] mb-2" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '2rem' }}>
            {ctx.isExpired ? 'INVITE EXPIRED' : 'INVITE FULL'}
          </h1>
          <p className="text-sm text-[#71717a] mb-6">
            {ctx.isExpired ? 'This invite link has expired.' : 'This invite has reached its maximum number of uses.'}
          </p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-[#1e1e1e] border border-[#27272a] text-[#a1a1aa] text-sm font-semibold hover:text-[#f4f4f5] transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Build the auth links so the event deep-link survives the round trip through signup/login.
  const eventQs = eventParam ? `&event=${encodeURIComponent(eventParam)}` : ''

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
        <Link href="/" className="text-2xl font-black text-[#e11d48] mb-10 tracking-wide" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
          JABSY
        </Link>

        <div className="w-full max-w-sm">
          {isWebView && <WebViewWarning inviteUrl={inviteUrl} />}
          <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-8">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[#1e1e1e]">
              <div className="w-12 h-12 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-[#e11d48]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-[#52525b] uppercase tracking-widest mb-0.5">You&apos;re invited to join</p>
                <h1 className="text-xl text-[#f4f4f5] uppercase leading-tight truncate" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
                  {ctx.leagueName}
                </h1>
                {ctx.leagueDescription && (
                  <p className="text-xs text-[#71717a] mt-1 leading-snug">{ctx.leagueDescription}</p>
                )}
              </div>
            </div>

            <p className="text-sm text-[#71717a] mb-5">Sign in or create an account to accept this invite.</p>

            <div className="flex flex-col gap-3">
              <Link
                href={`/signup?pending_invite=${code}${eventQs}`}
                className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-lg bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Create Account &amp; Join
              </Link>
              <Link
                href={`/login?pending_invite=${code}${eventQs}`}
                className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-lg bg-[#1e1e1e] border border-[#27272a] text-[#a1a1aa] text-sm font-semibold hover:text-[#f4f4f5] hover:border-[#333] transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Sign In &amp; Join
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Logged in — short-circuit if they're already a member or the owner.
  const { data: existing } = await supabase
    .from('league_members')
    .select('id')
    .eq('league_id', ctx.leagueId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    redirect(buildPostJoinUrl(ctx.leagueId, eventParam))
  }

  const { data: ownedLeague } = await supabase
    .from('leagues')
    .select('id')
    .eq('id', ctx.leagueId)
    .eq('owner_id', user.id)
    .single()

  if (ownedLeague) {
    redirect(buildPostJoinUrl(ctx.leagueId, eventParam))
  }

  async function handleJoin() {
    'use server'
    const result = await joinViaInvite(code)
    if ('error' in result) {
      const errQs = `error=${encodeURIComponent(result.error ?? 'Something went wrong')}`
      const evtQs = eventParam ? `&event=${encodeURIComponent(eventParam)}` : ''
      redirect(`/invite/${code}?${errQs}${evtQs}`)
    }
    if (result.leagueId) {
      const cookieStore = await cookies()
      cookieStore.delete('pending_invite')
      redirect(buildPostJoinUrl(result.leagueId, eventParam))
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <Link href="/" className="text-2xl font-black text-[#e11d48] mb-10 tracking-wide" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
        JABSY
      </Link>

      <div className="w-full max-w-sm">
        {isWebView && <WebViewWarning inviteUrl={inviteUrl} />}
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-8">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-[#1e1e1e]">
            <div className="w-12 h-12 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-[#e11d48]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-[#52525b] uppercase tracking-widest mb-0.5">You&apos;re invited to join</p>
              <h1 className="text-xl text-[#f4f4f5] uppercase leading-tight truncate" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
                {ctx.leagueName}
              </h1>
              {ctx.leagueDescription && (
                <p className="text-xs text-[#71717a] mt-1 leading-snug">{ctx.leagueDescription}</p>
              )}
            </div>
          </div>

          <p className="text-sm text-[#71717a] mb-5">Ready to compete? Accept the invite to join the league.</p>

          {joinError && (
            <p className="text-sm text-[#e11d48] mb-4">{joinError}</p>
          )}

          <form action={handleJoin}>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 h-11 w-full rounded-lg bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors cursor-pointer"
            >
              Accept &amp; Join League
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/dashboard" className="text-xs text-[#52525b] hover:text-[#71717a] transition-colors">
              Maybe later
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
