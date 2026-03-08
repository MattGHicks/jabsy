import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { Settings, Crown, Users, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LeagueTabs } from './league-tabs'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function LeaguePage({ params }: PageProps) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get league
  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  if (!league) notFound()

  // Get user's membership
  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  const isOwner = league.owner_id === user.id
  if (!isOwner && !membership) redirect('/dashboard')

  // Get events in this league with fight counts
  const { data: leagueEvents } = await supabase
    .from('league_events')
    .select('*, events(*, fights(id, status))')
    .eq('league_id', leagueId)
    .order('added_at', { ascending: false })

  // Get members with profiles
  const { data: members } = await supabase
    .from('league_members')
    .select('*, profiles(id, username, avatar_url, role)')
    .eq('league_id', leagueId)
    .order('joined_at', { ascending: true })

  // Get owner profile
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', league.owner_id)
    .single()

  const now = new Date()
  const events = (leagueEvents ?? [])
    .map((le) => le.events)
    .filter(Boolean)
    .map((event) => {
      // Derive effective display status from lock_time so the tile is always
      // correct without needing a DB write on every league page load.
      // upcoming + past lock_time → live; everything else uses DB value.
      const effectiveStatus =
        event.status === 'upcoming' && event.lock_time && now >= new Date(event.lock_time)
          ? 'live'
          : event.status
      return { ...event, status: effectiveStatus }
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) as Array<{
      id: string; name: string; start_time: string; lock_time: string | null; status: string; venue: string | null
      fights: { id: string; status: string }[]
    }>

  // Pick counts are only relevant while picks are still open (upcoming)
  const upcomingEventIds = events.filter((e) => e.status === 'upcoming').map((e) => e.id)
  let pickCounts: Record<string, number> = {}
  if (upcomingEventIds.length > 0) {
    const { data: picks } = await supabase
      .from('picks')
      .select('event_id')
      .eq('user_id', user.id)
      .eq('league_id', leagueId)
      .in('event_id', upcomingEventIds)
    for (const p of picks ?? []) {
      pickCounts[p.event_id] = (pickCounts[p.event_id] ?? 0) + 1
    }
  }

  // Build profile map from members + owner for winner lookup
  type ProfileInfo = { username: string | null; avatar_url: string | null }
  const profilesMap: Record<string, ProfileInfo> = {}
  if (ownerProfile) profilesMap[league.owner_id] = ownerProfile
  for (const m of members ?? []) {
    if (m.profiles) profilesMap[(m.profiles as { id: string }).id] = m.profiles as ProfileInfo
  }

  // Get winner(s) per completed event
  type WinnerInfo = { username: string | null; avatar_url: string | null; points: number }
  let eventWinners: Record<string, WinnerInfo[]> = {}
  const completedEventIds = events.filter((e) => e.status === 'completed').map((e) => e.id)
  if (completedEventIds.length > 0) {
    const { data: completedPicks } = await supabase
      .from('picks')
      .select('user_id, event_id, points_earned')
      .eq('league_id', leagueId)
      .in('event_id', completedEventIds)

    const totals: Record<string, Record<string, number>> = {}
    for (const p of completedPicks ?? []) {
      if (!totals[p.event_id]) totals[p.event_id] = {}
      totals[p.event_id][p.user_id] = (totals[p.event_id][p.user_id] ?? 0) + (p.points_earned ?? 0)
    }
    for (const eid of completedEventIds) {
      const eventTotals = totals[eid] ?? {}
      const maxPts = Math.max(...Object.values(eventTotals), 0)
      if (maxPts > 0) {
        eventWinners[eid] = Object.entries(eventTotals)
          .filter(([, pts]) => pts === maxPts)
          .map(([uid]) => ({ ...profilesMap[uid], points: maxPts }))
      }
    }
  }

  // Build league standings from all picks in this league
  const { data: allLeaguePicks } = await supabase
    .from('picks')
    .select('user_id, points_earned')
    .eq('league_id', leagueId)

  // Include all league members in standings (even those with 0 picks)
  const allMemberIds = [
    league.owner_id,
    ...((members ?? []).map((m) => (m.profiles as { id: string } | null)?.id).filter(Boolean) as string[]),
  ]
  const uniqueMemberIds = [...new Set(allMemberIds)]

  const standingsTotals: Record<string, number> = {}
  for (const p of allLeaguePicks ?? []) {
    standingsTotals[p.user_id] = (standingsTotals[p.user_id] ?? 0) + (p.points_earned ?? 0)
  }

  const standings = uniqueMemberIds
    .map((uid) => ({ userId: uid, totalPoints: standingsTotals[uid] ?? 0 }))
    .sort((a, b) => b.totalPoints - a.totalPoints)

  // Flatten members for the Members tab
  const flatMembers = (members ?? [])
    .map((m) => m.profiles as { id: string; username: string | null; avatar_url: string | null } | null)
    .filter((p): p is { id: string; username: string | null; avatar_url: string | null } => p !== null)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <Link href="/dashboard" className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70">
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#3f3f46] uppercase mb-1">Back to</span>
          <span className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}>Dashboard</span>
        </div>
      </Link>

      {/* Header */}
      <div className="flex items-stretch gap-4 mb-8">
        {/* Accent bar — red spine for owner, dim for member */}
        <div className={`w-0.5 rounded-full shrink-0 ${isOwner ? 'bg-[#e11d48]' : 'bg-[#2a2a2a]'}`} />

        <div className="flex-1 min-w-0 py-0.5">
          {/* Title + Settings on the same row */}
          <div className="flex items-center gap-3 mb-1.5">
            <h1
              className="flex-1 min-w-0 leading-none text-[#f4f4f5] uppercase"
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}
            >
              {league.name}
            </h1>
            {isOwner && (
              <Link
                href={`/leagues/${leagueId}/settings`}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#141414] border border-[#1e1e1e] text-[#52525b] hover:text-[#a1a1aa] hover:border-[#2a2a2a] transition-all"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="text-[11px] uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, letterSpacing: '0.06em' }}>Settings</span>
              </Link>
            )}
          </div>

          {/* Subtitle row: role + optional description */}
          <div className="flex items-center gap-2">
            {isOwner ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#e11d48]/50">
                <Crown className="w-2.5 h-2.5" />
                Owner
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#3f3f46]">
                <Users className="w-2.5 h-2.5" />
                Member
              </span>
            )}
            {league.description && (
              <>
                <span className="text-[#222] select-none">·</span>
                <p className="text-[13px] text-[#52525b] leading-snug">{league.description}</p>
              </>
            )}
          </div>
        </div>
      </div>

      <LeagueTabs
        leagueId={leagueId}
        events={events}
        isOwner={isOwner}
        pickCounts={pickCounts}
        eventWinners={eventWinners}
        standings={standings}
        profilesMap={profilesMap}
        currentUserId={user.id}
        members={flatMembers}
        ownerProfile={ownerProfile ? { id: ownerProfile.id, username: ownerProfile.username, avatar_url: ownerProfile.avatar_url } : null}
        leagueOwnerId={league.owner_id}
        standingsTotals={standingsTotals}
      />
    </div>
  )
}
