import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { Settings, Crown, Users, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInitials } from '@/lib/utils'
import { calcWeightedAccuracy } from '@/lib/accuracy'
import { LeagueTabs } from './league-tabs'
import type { LeagueStats } from './league-tabs'
import { ShareButton } from '@/components/share-button'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function LeaguePage({ params, searchParams }: PageProps) {
  const { leagueId } = await params
  const { tab } = await searchParams
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

  // Build league standings from all picks in this league (with fight data for weighted accuracy)
  const { data: allLeaguePicks } = await supabase
    .from('picks')
    .select('user_id, event_id, points_earned, fights!inner(result_method, result_winner)')
    .eq('league_id', leagueId)

  type FightJoin = { result_method: string; result_winner: string | null }

  // Include all league members in standings (even those with 0 picks)
  const allMemberIds = [
    league.owner_id,
    ...((members ?? []).map((m) => (m.profiles as { id: string } | null)?.id).filter(Boolean) as string[]),
  ]
  const uniqueMemberIds = [...new Set(allMemberIds)]

  // Group picks by user for accuracy calculation
  const standingsTotals: Record<string, number> = {}
  const userPicks: Record<string, { points_earned: number | null; result_method: string; result_winner: string | null }[]> = {}
  for (const p of allLeaguePicks ?? []) {
    standingsTotals[p.user_id] = (standingsTotals[p.user_id] ?? 0) + (p.points_earned ?? 0)
    if (!userPicks[p.user_id]) userPicks[p.user_id] = []
    const f = p.fights as unknown as FightJoin
    userPicks[p.user_id].push({
      points_earned: p.points_earned,
      result_method: f.result_method,
      result_winner: f.result_winner,
    })
  }

  const standings = uniqueMemberIds
    .map((uid) => ({
      userId: uid,
      totalPoints: standingsTotals[uid] ?? 0,
      accuracy: calcWeightedAccuracy(userPicks[uid] ?? []),
    }))
    .sort((a, b) => (b.accuracy ?? -1) - (a.accuracy ?? -1))

  // ── Compute League Stats ──────────────────────────────────
  const leagueStats: LeagueStats = {
    mostEventWins: null,
    highestAccuracy: null,
    mostPoints: null,
    bestEventScore: null,
    tightestFinish: null,
    mostPerfectPicks: null,
  }

  // Most Event Wins — count appearances per user in eventWinners
  const winCounts: Record<string, number> = {}
  for (const winners of Object.values(eventWinners)) {
    for (const w of winners) {
      // find user id by matching username in profilesMap
      const uid = Object.entries(profilesMap).find(([, p]) => p.username === w.username)?.[0]
      if (uid) winCounts[uid] = (winCounts[uid] ?? 0) + 1
    }
  }
  const topWinner = Object.entries(winCounts).sort(([, a], [, b]) => b - a)[0]
  if (topWinner) {
    const p = profilesMap[topWinner[0]]
    leagueStats.mostEventWins = { username: p?.username ?? null, avatar_url: p?.avatar_url ?? null, count: topWinner[1] }
  }

  // Highest Accuracy — first entry in standings (already sorted by accuracy)
  const topAccuracy = standings.find((s) => s.accuracy !== null)
  if (topAccuracy) {
    const p = profilesMap[topAccuracy.userId]
    leagueStats.highestAccuracy = { username: p?.username ?? null, avatar_url: p?.avatar_url ?? null, value: topAccuracy.accuracy! }
  }

  // Most Points — max standingsTotals
  const topPointsEntry = Object.entries(standingsTotals).sort(([, a], [, b]) => b - a)[0]
  if (topPointsEntry && topPointsEntry[1] > 0) {
    const p = profilesMap[topPointsEntry[0]]
    leagueStats.mostPoints = { username: p?.username ?? null, avatar_url: p?.avatar_url ?? null, value: topPointsEntry[1] }
  }

  // Best Event Score — highest single-event total by any player
  const eventUserScores: Record<string, Record<string, number>> = {} // event_id → user_id → total
  for (const pick of allLeaguePicks ?? []) {
    if (!eventUserScores[pick.event_id]) eventUserScores[pick.event_id] = {}
    eventUserScores[pick.event_id][pick.user_id] = (eventUserScores[pick.event_id][pick.user_id] ?? 0) + (pick.points_earned ?? 0)
  }
  let bestScore = 0
  let bestScoreUid = ''
  let bestScoreEventId = ''
  for (const [eid, users] of Object.entries(eventUserScores)) {
    for (const [uid, total] of Object.entries(users)) {
      if (total > bestScore) { bestScore = total; bestScoreUid = uid; bestScoreEventId = eid }
    }
  }
  if (bestScore > 0) {
    const p = profilesMap[bestScoreUid]
    const eventName = events.find((e) => e.id === bestScoreEventId)?.name ?? 'Event'
    leagueStats.bestEventScore = { username: p?.username ?? null, avatar_url: p?.avatar_url ?? null, value: bestScore, eventName }
  }

  // Tightest Finish — smallest gap between 1st and 2nd in a completed event
  const completedEventIds2 = events.filter((e) => e.status === 'completed').map((e) => e.id)
  let tightestMargin = Infinity
  let tightestEventName = ''
  for (const eid of completedEventIds2) {
    const scores = Object.values(eventUserScores[eid] ?? {}).sort((a, b) => b - a)
    if (scores.length >= 2) {
      const margin = scores[0] - scores[1]
      if (margin < tightestMargin && margin >= 0) {
        tightestMargin = margin
        tightestEventName = events.find((e) => e.id === eid)?.name ?? 'Event'
      }
    }
  }
  if (tightestMargin < Infinity) {
    leagueStats.tightestFinish = { eventName: tightestEventName, margin: tightestMargin }
  }

  // Most Perfect Picks — user(s) with most 10-point picks (handles ties)
  const perfectCounts: Record<string, number> = {}
  for (const pick of allLeaguePicks ?? []) {
    if (pick.points_earned === 10) {
      perfectCounts[pick.user_id] = (perfectCounts[pick.user_id] ?? 0) + 1
    }
  }
  const maxPerfect = Math.max(...Object.values(perfectCounts), 0)
  if (maxPerfect > 0) {
    const tiedUsers = Object.entries(perfectCounts)
      .filter(([, count]) => count === maxPerfect)
      .map(([uid]) => {
        const p = profilesMap[uid]
        return { username: p?.username ?? null, avatar_url: p?.avatar_url ?? null }
      })
    leagueStats.mostPerfectPicks = { users: tiedUsers, count: maxPerfect }
  }

  // Flatten members for the League Stats tab
  const flatMembers = (members ?? [])
    .map((m) => m.profiles as { id: string; username: string | null; avatar_url: string | null } | null)
    .filter((p): p is { id: string; username: string | null; avatar_url: string | null } => p !== null)

  // Member joined-at lookup (for the Standings rows)
  const joinedAt: Record<string, string> = {}
  for (const m of members ?? []) {
    if (m.user_id && m.joined_at) joinedAt[m.user_id] = m.joined_at
  }
  if (ownerProfile && league.created_at) joinedAt[ownerProfile.id] = league.created_at

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <Link href="/dashboard" className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70">
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#52525b] uppercase mb-1">Back to</span>
          <span className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}>Dashboard</span>
        </div>
      </Link>

      {/* ── League Hero ── */}
      <div className="relative rounded-2xl overflow-hidden mb-8 border border-[#1e1e1e]">
        {/* Neutral gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#141414] via-[#111111] to-[#0d0d0d]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(225,29,72,0.06),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(255,255,255,0.02),transparent_60%)]" />

        {/* Content */}
        <div className="relative px-5 sm:px-7 pt-8 sm:pt-10 pb-5 sm:pb-6">
          {/* League image + title */}
          <div className="flex items-end gap-4 sm:gap-5 mb-4">
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl shrink-0 overflow-hidden shadow-2xl ring-1 ring-white/5 ${
              !league.avatar_url ? (isOwner ? 'bg-[#e11d48]/10 border-2 border-[#e11d48]/20 flex items-center justify-center' : 'bg-[#1a1a1a] border-2 border-[#27272a] flex items-center justify-center') : ''
            }`}>
              {league.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={league.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
              ) : (
                <span
                  className={`text-2xl sm:text-3xl leading-none ${isOwner ? 'text-[#e11d48]' : 'text-[#52525b]'}`}
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
                >
                  {getInitials(league.name)}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 pb-0.5">
              <h1
                className="text-[#f4f4f5] uppercase leading-[0.9] mb-2 drop-shadow-lg"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 3rem)' }}
              >
                {league.name}
              </h1>
              {league.description && (
                <p className="text-[13px] text-[#a1a1aa]/70 leading-snug line-clamp-2">{league.description}</p>
              )}
            </div>
          </div>

          {/* Bottom bar: member avatars + settings */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
            <div className="flex items-center gap-3">
              {/* Stacked member avatars */}
              <div className="flex -space-x-2">
                {(() => {
                  const seen = new Set<string>()
                  const all = [ownerProfile, ...((members ?? []).map((m) => m.profiles as { id: string; username: string | null; avatar_url: string | null } | null).filter(Boolean))].filter((m): m is { id: string; username: string | null; avatar_url: string | null } => {
                    if (!m || seen.has(m.id)) return false
                    seen.add(m.id)
                    return true
                  })
                  const overflow = all.length - 8
                  return (<>
                    {all.slice(0, 8).map((m, i) => (
                      <div key={m.id} className="w-7 h-7 rounded-full border-2 border-[#0a0a0a] bg-[#1e1e1e] overflow-hidden shrink-0" style={{ zIndex: 8 - i }}>
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[8px] font-bold text-[#52525b] flex items-center justify-center w-full h-full" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                            {getInitials(m.username ?? 'U')}
                          </span>
                        )}
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="w-7 h-7 rounded-full border-2 border-[#0a0a0a] bg-[#1e1e1e] shrink-0 flex items-center justify-center" style={{ zIndex: 0 }}>
                        <span className="text-[8px] font-bold text-[#52525b]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>+{overflow}</span>
                      </div>
                    )}
                  </>)
                })()}
              </div>
              <span className="text-[11px] text-[#71717a]">
                {uniqueMemberIds.length} {uniqueMemberIds.length === 1 ? 'member' : 'members'} · {events.length} {events.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ShareButton
                code={league.share_code}
                shareTitle={`Join ${league.name} on Jabsy`}
                shareText={`Join my fantasy MMA league "${league.name}" on Jabsy.`}
                variant="pill"
                label="Invite"
              />
              {isOwner && (
                <Link
                  href={`/leagues/${leagueId}/settings`}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-[#a1a1aa] hover:bg-white/[0.06] hover:text-[#f4f4f5] transition-all"
                  aria-label="League settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <LeagueTabs
        leagueId={leagueId}
        leagueName={league.name}
        shareCode={league.share_code}
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
        leagueStats={leagueStats}
        currentUserProfile={profilesMap[user.id] ?? { username: null, avatar_url: null }}
        joinedAt={joinedAt}
        initialTab={tab === 'events' || tab === 'completed' || tab === 'standings' || tab === 'stats' || tab === 'activity' ? tab : undefined}
      />
    </div>
  )
}
