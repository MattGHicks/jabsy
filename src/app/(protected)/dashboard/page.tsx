import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Users, Crown, Shield, Zap, Target, TrendingUp, Trophy, Award, Crosshair, Clock, Lock, ChevronRight, MessageCircle, Radio } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInitials } from '@/lib/utils'
import { JoinWithCode } from './join-with-code'
import { calcWeightedAccuracy } from '@/lib/accuracy'
import { getUnreadCounts } from '@/actions/chat'
import { LockCountdown } from '@/components/lock-countdown'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, ownedLeaguesRes, membershipsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('leagues').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
    supabase.from('league_members').select('league_id, role, leagues(*)').eq('user_id', user.id).order('joined_at', { ascending: false }),
  ])

  const profile = profileRes.data
  const ownedLeagues = ownedLeaguesRes.data
  const memberships = membershipsRes.data

  // Build a unified list, avoiding duplicates (owner is also a member)
  const ownedIds = new Set((ownedLeagues ?? []).map((l) => l.id))
  const memberLeagues = (memberships ?? [])
    .filter((m) => !ownedIds.has(m.league_id))
    .map((m) => ({ ...m.leagues as Record<string, unknown>, _role: m.role }))

  const owned = (ownedLeagues ?? []).map((l) => ({ ...l, _role: 'owner' }))
  const allLeagues = [...owned, ...memberLeagues]

  // Get member counts and event counts per league
  const leagueIds = allLeagues.map((l) => (l as { id: string }).id)

  let memberCounts: Record<string, number> = {}
  let eventCounts: Record<string, number> = {}
  const nextEvents: Record<string, { id: string; name: string; start_time: string }> = {}
  const liveEventsByLeague: Record<string, { id: string; name: string }> = {}

  if (leagueIds.length > 0) {
    const [membersRes, leagueEventsRes, upcomingEventsRes] = await Promise.all([
      supabase.from('league_members').select('league_id').in('league_id', leagueIds),
      supabase.from('league_events').select('league_id').in('league_id', leagueIds),
      supabase
        .from('league_events')
        .select('league_id, events(id, name, start_time, status)')
        .in('league_id', leagueIds)
        .order('added_at', { ascending: true }),
    ])

    memberCounts = (membersRes.data ?? []).reduce<Record<string, number>>((acc, m) => {
      acc[m.league_id] = (acc[m.league_id] ?? 0) + 1
      return acc
    }, {})

    eventCounts = (leagueEventsRes.data ?? []).reduce<Record<string, number>>((acc, e) => {
      acc[e.league_id] = (acc[e.league_id] ?? 0) + 1
      return acc
    }, {})

    // Find next upcoming + live events per league
    for (const le of upcomingEventsRes.data ?? []) {
      const ev = le.events as { id: string; name: string; start_time: string; status: string } | null
      if (ev && ev.status === 'upcoming') {
        if (!nextEvents[le.league_id] || new Date(ev.start_time) < new Date(nextEvents[le.league_id].start_time)) {
          nextEvents[le.league_id] = { id: ev.id, name: ev.name, start_time: ev.start_time }
        }
      }
      if (ev && ev.status === 'live' && !liveEventsByLeague[le.league_id]) {
        liveEventsByLeague[le.league_id] = { id: ev.id, name: ev.name }
      }
    }
  }

  // Personal stats + league rankings + unread counts — parallel where possible
  const [myPicksRes, ...leagueDataRes] = await Promise.all([
    supabase
      .from('picks')
      .select('points_earned, event_id, league_id, pick_winner, fights!inner(bout_order, result_method, result_winner), events!inner(start_time)')
      .eq('user_id', user.id),
    ...(leagueIds.length > 0
      ? [
          supabase.from('picks').select('league_id, event_id, user_id, points_earned').in('league_id', leagueIds),
          getUnreadCounts(leagueIds),
        ]
      : []),
  ])

  const myPicks = myPicksRes.data
  const allLeaguePicksData = leagueIds.length > 0 ? (leagueDataRes[0] as { data: { league_id: string; event_id: string; user_id: string; points_earned: number | null }[] | null }).data : null
  const unreadCounts: Record<string, number> = leagueIds.length > 0 ? (leagueDataRes[1] as Record<string, number>) : {}

  type FightJoin = { bout_order: number; result_method: string; result_winner: string | null }
  type EventJoin = { start_time: string }
  const scoredPicks = (myPicks ?? []).filter((p) => p.points_earned !== null)
  const totalPts = scoredPicks.reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
  const accuracy = calcWeightedAccuracy(
    scoredPicks.map((p) => {
      const f = p.fights as unknown as FightJoin
      return { points_earned: p.points_earned, result_method: f.result_method, result_winner: f.result_winner }
    })
  )
  const totalPicksMade = (myPicks ?? []).length
  const perfectPicks = scoredPicks.filter((p) => p.points_earned === 10).length

  // Best single-event score
  const eventScores: Record<string, number> = {}
  for (const p of scoredPicks) {
    eventScores[p.event_id] = (eventScores[p.event_id] ?? 0) + (p.points_earned ?? 0)
  }
  const bestEventScore = Object.values(eventScores).length > 0
    ? Math.max(...Object.values(eventScores))
    : null

  // League rankings — all picks in user's leagues grouped by (league_id, user_id)
  const userRanks: Record<string, { rank: number; total: number; of: number }> = {}
  if (leagueIds.length > 0) {
    const allLeaguePicks = allLeaguePicksData

    // Build totals per (league, user)
    const leagueUserTotals: Record<string, Record<string, number>> = {}
    for (const p of allLeaguePicks ?? []) {
      if (!leagueUserTotals[p.league_id]) leagueUserTotals[p.league_id] = {}
      leagueUserTotals[p.league_id][p.user_id] = (leagueUserTotals[p.league_id][p.user_id] ?? 0) + (p.points_earned ?? 0)
    }

    // Rank user in each league
    for (const lid of leagueIds) {
      const totals = leagueUserTotals[lid] ?? {}
      const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a)
      const userIdx = sorted.findIndex(([uid]) => uid === user.id)
      const memberCount = memberCounts[lid] ?? 1
      if (userIdx >= 0) {
        userRanks[lid] = { rank: userIdx + 1, total: totals[user.id] ?? 0, of: Math.max(sorted.length, memberCount) }
      } else {
        userRanks[lid] = { rank: memberCount, total: 0, of: memberCount }
      }
    }
  }

  // Event wins — count of distinct (league, event) pairs where the user
  // scored at least as high as every other member who picked. Ties count
  // as wins for everyone tied (matches the league-page Winners callout).
  let winCount = 0
  if (allLeaguePicksData) {
    const totalsByEvent: Record<string, Record<string, number>> = {}
    for (const p of allLeaguePicksData) {
      const k = `${p.league_id}::${p.event_id}`
      if (!totalsByEvent[k]) totalsByEvent[k] = {}
      totalsByEvent[k][p.user_id] = (totalsByEvent[k][p.user_id] ?? 0) + (p.points_earned ?? 0)
    }
    for (const totals of Object.values(totalsByEvent)) {
      const userTotal = totals[user.id] ?? 0
      if (userTotal <= 0) continue
      const max = Math.max(...Object.values(totals))
      if (userTotal === max) winCount++
    }
  }

  // Hot/cold streak — consecutive correct/incorrect winner picks, most recent first.
  // Sort: event start_time DESC (newest event first), then bout_order ASC within an
  // event (bout 1 = main event, fought last chronologically, so it's the most recent
  // outcome). Without the secondary sort the order within an event is undefined and
  // the streak calculation is non-deterministic.
  let streak = 0
  let streakType: 'hot' | 'cold' | null = null
  {
    const orderedScored = scoredPicks
      .filter((p) => (p as unknown as { events: EventJoin | null }).events?.start_time)
      .sort((a, b) => {
        const ta = new Date((a as unknown as { events: EventJoin }).events.start_time).getTime()
        const tb = new Date((b as unknown as { events: EventJoin }).events.start_time).getTime()
        if (ta !== tb) return tb - ta
        const ba = (a as unknown as { fights: FightJoin }).fights.bout_order
        const bb = (b as unknown as { fights: FightJoin }).fights.bout_order
        return ba - bb
      })
    for (const p of orderedScored) {
      const correct = (p.points_earned ?? 0) >= 5
      if (!streakType) { streakType = correct ? 'hot' : 'cold'; streak = 1 }
      else if ((correct && streakType === 'hot') || (!correct && streakType === 'cold')) streak++
      else break
    }
  }

  // Global next event — soonest upcoming across all leagues
  const leagueNameMap: Record<string, string> = {}
  for (const l of allLeagues) {
    const league = l as { id: string; name: string }
    leagueNameMap[league.id] = league.name
  }
  let globalNextEvent: { id: string; name: string; start_time: string; league_name: string; league_id: string } | null = null
  for (const [lid, ev] of Object.entries(nextEvents)) {
    if (!globalNextEvent || new Date(ev.start_time) < new Date(globalNextEvent.start_time)) {
      globalNextEvent = { ...ev, league_name: leagueNameMap[lid] ?? '', league_id: lid }
    }
  }

  // Pick first live event found across all leagues
  let globalLiveEvent: { id: string; name: string; league_name: string; league_id: string } | null = null
  for (const [lid, ev] of Object.entries(liveEventsByLeague)) {
    globalLiveEvent = { ...ev, league_name: leagueNameMap[lid] ?? '', league_id: lid }
    break
  }

  // New supplemental queries (next event hero + recent event recap)
  const [nextEventFightsRes, nextPicksCountRes, recentEventLookupRes] = await Promise.all([
    globalNextEvent
      ? supabase
          .from('fights')
          .select('id, is_main_event, red_name, blue_name, weight_class, bout_order')
          .eq('event_id', globalNextEvent.id)
          .neq('status', 'cancelled')
          .order('bout_order', { ascending: true })
      : Promise.resolve({ data: [] as { id: string; is_main_event: boolean; red_name: string; blue_name: string; weight_class: string | null; bout_order: number }[] }),
    globalNextEvent
      ? supabase
          .from('picks')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('event_id', globalNextEvent.id)
          .eq('league_id', globalNextEvent.league_id)
      : Promise.resolve({ count: 0 }),
    leagueIds.length > 0
      ? supabase
          .from('events')
          .select('id, name, start_time, status, league_events!inner(league_id)')
          .eq('status', 'completed')
          .in('league_events.league_id', leagueIds)
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  type NextEventFight = { id: string; is_main_event: boolean; red_name: string; blue_name: string; weight_class: string | null; bout_order: number }
  const nextEventFights = (nextEventFightsRes.data ?? []) as NextEventFight[]
  const mainEventFight = nextEventFights.find(f => f.is_main_event) ?? nextEventFights[0] ?? null
  const nextFightCount = nextEventFights.length
  const nextPicksCount = (nextPicksCountRes as { count: number | null }).count ?? 0

  // Find most recently completed event
  type RecentEventRow = { id: string; name: string; start_time: string; status: string; league_events: { league_id: string }[] }
  const recentEventData = (recentEventLookupRes.data) as RecentEventRow | null
  const recentEvent = recentEventData ? { id: recentEventData.id, name: recentEventData.name, start_time: recentEventData.start_time } : null
  const recentEventLeagueId = recentEventData?.league_events?.[0]?.league_id ?? null

  // Fetch recap data for recent event
  type RecapPick = { fight_id: string; pick_winner: string; points_earned: number | null; fights: { red_name: string; blue_name: string; result_winner: string | null } | null }
  let recentEventPicks: RecapPick[] = []
  let recentEventScore = 0
  let recentEventRank: { rank: number; of: number } | null = null
  if (recentEvent) {
    const [recapMyPicksRes, recapAllPicksRes] = await Promise.all([
      supabase
        .from('picks')
        .select('fight_id, pick_winner, points_earned, fights!inner(red_name, blue_name, result_winner)')
        .eq('user_id', user.id)
        .eq('event_id', recentEvent.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('picks')
        .select('user_id, points_earned')
        .eq('event_id', recentEvent.id)
        .not('points_earned', 'is', null),
    ])
    recentEventPicks = (recapMyPicksRes.data ?? []).map(p => ({
      fight_id: p.fight_id,
      pick_winner: p.pick_winner,
      points_earned: p.points_earned,
      fights: p.fights as unknown as { red_name: string; blue_name: string; result_winner: string | null } | null,
    }))
    recentEventScore = recentEventPicks.reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
    // Compute rank
    const allScores: Record<string, number> = {}
    for (const p of recapAllPicksRes.data ?? []) {
      allScores[p.user_id] = (allScores[p.user_id] ?? 0) + (p.points_earned ?? 0)
    }
    const sorted = Object.values(allScores).sort((a, b) => b - a)
    const myScore = allScores[user.id] ?? 0
    const rank = sorted.findIndex(s => s <= myScore) + 1
    recentEventRank = { rank, of: sorted.length }
  }

  // Per-league accuracy from already-fetched picks
  const leagueAccuracy: Record<string, number | null> = {}
  for (const lid of leagueIds) {
    const lPicks = scoredPicks.filter((p) => p.league_id === lid)
    leagueAccuracy[lid] = calcWeightedAccuracy(
      lPicks.map((p) => {
        const f = p.fights as unknown as FightJoin
        return { points_earned: p.points_earned, result_method: f.result_method, result_winner: f.result_winner }
      })
    )
  }

  const canCreateLeague = profile?.role === 'admin' || profile?.role === 'league_owner'

  const stats = [
    { label: 'Total Points', value: totalPts > 0 ? totalPts.toString() : '—', icon: Zap, accent: '#e11d48', accentBg: 'rgba(225,29,72,0.08)', accentBorder: 'rgba(225,29,72,0.15)' },
    { label: 'Accuracy', value: accuracy !== null ? `${accuracy}%` : '—', icon: Target, accent: '#60a5fa', accentBg: 'rgba(96,165,250,0.08)', accentBorder: 'rgba(96,165,250,0.15)' },
    { label: 'Total Picks', value: totalPicksMade > 0 ? totalPicksMade.toString() : '—', icon: TrendingUp, accent: '#71717a', accentBg: 'rgba(113,113,122,0.08)', accentBorder: 'rgba(113,113,122,0.15)' },
    { label: 'Best Event', value: bestEventScore !== null ? bestEventScore.toString() : '—', icon: Trophy, accent: '#fbbf24', accentBg: 'rgba(251,191,36,0.08)', accentBorder: 'rgba(251,191,36,0.15)' },
    { label: 'Total Wins', value: winCount > 0 ? winCount.toString() : '—', icon: Award, accent: '#34d399', accentBg: 'rgba(52,211,153,0.08)', accentBorder: 'rgba(52,211,153,0.15)' },
    { label: 'Perfect Picks', value: perfectPicks > 0 ? perfectPicks.toString() : '—', icon: Crosshair, accent: '#a78bfa', accentBg: 'rgba(167,139,250,0.08)', accentBorder: 'rgba(167,139,250,0.15)' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

      {/* ═══ Header ═══ */}
      <div className="mb-10">
        <p className="text-[10px] font-semibold text-[#e11d48] uppercase tracking-[0.2em] mb-1.5">
          Welcome back, {profile?.username}
        </p>
        <h1
          className="leading-[0.9] text-[#f4f4f5] uppercase"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}
        >
          My Dashboard
        </h1>
      </div>

      {/* ═══ Stats ═══ */}
      <section className="mb-10">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3">Your Stats</p>

        {/* Mobile: 3+3 grid */}
        <div className="sm:hidden grid grid-cols-3 gap-2.5">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-[#111111] border border-[#1e1e1e]">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: s.accentBg, border: `1px solid ${s.accentBorder}` }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
              <div className="text-center">
                <p className="text-2xl leading-none text-[#f4f4f5] mb-1" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                  {s.value}
                </p>
                <p className="text-[9px] text-[#52525b] uppercase tracking-[0.12em]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: 6-col */}
        <div className="hidden sm:grid grid-cols-6 gap-2.5">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2 py-5 px-3 rounded-xl bg-[#111111] border border-[#1e1e1e]">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: s.accentBg, border: `1px solid ${s.accentBorder}` }}
              >
                <s.icon className="w-5 h-5" style={{ color: s.accent }} />
              </div>
              <div className="text-center">
                <p className="text-3xl leading-none text-[#f4f4f5] mb-1" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                  {s.value}
                </p>
                <p className="text-[10px] text-[#52525b] uppercase tracking-[0.12em]">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Streak banner */}
        {streak >= 2 && streakType && (
          <div
            className="mt-3 flex items-center gap-4 px-5 py-3.5 rounded-xl border"
            style={{
              background: streakType === 'hot'
                ? 'linear-gradient(135deg, rgba(251,146,60,0.07) 0%, rgba(239,68,68,0.04) 100%)'
                : 'linear-gradient(135deg, rgba(96,165,250,0.07) 0%, rgba(147,197,253,0.03) 100%)',
              borderColor: streakType === 'hot' ? 'rgba(251,146,60,0.18)' : 'rgba(96,165,250,0.18)',
            }}
          >
            <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{streakType === 'hot' ? '🔥' : '❄️'}</span>
            <div className="flex-1">
              <p
                className="leading-none uppercase"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', color: streakType === 'hot' ? '#fb923c' : '#60a5fa' }}
              >
                {streak}-Pick {streakType === 'hot' ? 'Hot' : 'Cold'} Streak
              </p>
              <p className="text-[10px] uppercase tracking-[0.15em] mt-0.5" style={{ color: streakType === 'hot' ? 'rgba(251,146,60,0.5)' : 'rgba(96,165,250,0.5)' }}>
                {streakType === 'hot' ? 'Keep it going' : 'Time to turn it around'}
              </p>
            </div>
            <div className="flex gap-0.5 shrink-0">
              {Array.from({ length: Math.min(streak, 8) }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: streakType === 'hot' ? `rgba(251,146,60,${1 - i * 0.08})` : `rgba(96,165,250,${1 - i * 0.08})` }}
                />
              ))}
              {streak > 8 && <span className="text-[9px] ml-1" style={{ color: streakType === 'hot' ? '#fb923c' : '#60a5fa' }}>+{streak - 8}</span>}
            </div>
          </div>
        )}
      </section>

      {/* ═══ Leagues ═══ */}
      {allLeagues.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">
                My Leagues
              </p>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#3f3f46] bg-[#111111] border border-[#1e1e1e]">
                {allLeagues.length}
              </span>
            </div>
            {canCreateLeague && (
              <Link
                href="/leagues/new"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] text-xs font-semibold hover:bg-[#e11d48]/15 hover:border-[#e11d48]/30 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New League
              </Link>
            )}
          </div>

          {/* Mobile: spacious rows */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {allLeagues.map((league) => {
              const l = league as { id: string; name: string; created_at: string; description?: string | null; avatar_url?: string | null; _role: string }
              const isOwner = l._role === 'owner' || l._role === 'admin'
              const memberCount = memberCounts[l.id] ?? 0
              const eventCount = eventCounts[l.id] ?? 0
              const nextEvent = nextEvents[l.id]
              const rank = userRanks[l.id]
              const unread = unreadCounts[l.id] ?? 0
              const acc = leagueAccuracy[l.id]

              return (
                <Link
                  key={l.id}
                  href={`/leagues/${l.id}`}
                  className={`group relative flex flex-col rounded-2xl bg-[#111111] border overflow-hidden transition-all active:scale-[0.98] ${
                    isOwner ? 'border-[#e11d48]/20' : 'border-[#1e1e1e]'
                  }`}
                >
                  {/* Top accent bar */}
                  <div className={`h-0.5 w-full ${isOwner ? 'bg-gradient-to-r from-[#e11d48] to-[#e11d48]/20' : 'bg-[#1e1e1e]'}`} />

                  <div className="p-4">
                    {/* Top row: avatar + name + unread */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative shrink-0">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden ${
                          isOwner ? 'bg-[#e11d48]/8 border border-[#e11d48]/15' : 'bg-[#0a0a0a] border border-[#1e1e1e]'
                        }`}>
                          {l.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            <span
                              className={`text-lg leading-none ${isOwner ? 'text-[#e11d48]' : 'text-[#52525b]'}`}
                              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
                            >
                              {getInitials(l.name)}
                            </span>
                          )}
                        </div>
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-1 bg-[#22c55e] text-[#0a0a0a] text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center shadow-sm shadow-[#22c55e]/30">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <h3
                            className="text-base text-[#f4f4f5] uppercase leading-tight truncate group-hover:text-white transition-colors"
                            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                          >
                            {l.name}
                          </h3>
                          {isOwner && <Crown className="w-3 h-3 text-[#e11d48]/40 shrink-0" />}
                        </div>
                        {nextEvent ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0 animate-pulse" />
                            <span className="truncate text-sm uppercase text-blue-400/70" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{nextEvent.name}</span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#52525b]">No upcoming events</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#3f3f46] group-hover:text-[#52525b] transition-colors shrink-0" />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-0 border-t border-[#1e1e1e] pt-3">
                      <div className="flex-1 text-center">
                        <div
                          className={`text-2xl leading-none ${isOwner ? 'text-[#e11d48]' : 'text-[#f4f4f5]'}`}
                          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                        >
                          {acc !== null ? `${acc}%` : '—'}
                        </div>
                        <div className="text-[9px] text-[#52525b] uppercase tracking-wider mt-1">accuracy</div>
                      </div>
                      <div className="w-px h-8 bg-[#1e1e1e]" />
                      <div className="flex-1 text-center">
                        <div
                          className="text-2xl leading-none text-[#52525b]"
                          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
                        >
                          {rank && rank.of > 1 ? `#${rank.rank}` : '—'}
                        </div>
                        <div className="text-[9px] text-[#3f3f46] uppercase tracking-wider mt-1">
                          {rank && rank.of > 1 ? `of ${rank.of}` : 'rank'}
                        </div>
                      </div>
                      <div className="w-px h-8 bg-[#1e1e1e]" />
                      <div className="flex-1 text-center">
                        <div
                          className="text-2xl leading-none text-[#71717a]"
                          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
                        >
                          {memberCount}
                        </div>
                        <div className="text-[9px] text-[#3f3f46] uppercase tracking-wider mt-1">members</div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Desktop: card grid */}
          <div className={`hidden sm:grid gap-3 ${allLeagues.length === 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
            {allLeagues.map((league) => {
              const l = league as { id: string; name: string; created_at: string; description?: string | null; avatar_url?: string | null; _role: string }
              const isOwner = l._role === 'owner' || l._role === 'admin'
              const memberCount = memberCounts[l.id] ?? 0
              const eventCount = eventCounts[l.id] ?? 0
              const nextEvent = nextEvents[l.id]
              const rank = userRanks[l.id]
              const unread = unreadCounts[l.id] ?? 0
              const acc = leagueAccuracy[l.id]

              return (
                <Link
                  key={l.id}
                  href={`/leagues/${l.id}`}
                  className={`group relative flex flex-col rounded-xl bg-[#111111] border overflow-hidden transition-all hover:border-[#27272a] ${
                    isOwner ? 'border-[#e11d48]/15' : 'border-[#1e1e1e]'
                  }`}
                >
                  {/* Top accent */}
                  <div className={`h-0.5 w-full ${isOwner ? 'bg-gradient-to-r from-[#e11d48] to-[#e11d48]/20' : 'bg-[#1e1e1e]'}`} />

                  {/* Unread chat badge */}
                  {unread > 0 && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-full px-1.5 py-0.5 z-10">
                      <MessageCircle className="w-3 h-3 text-[#22c55e]" />
                      <span className="text-[9px] font-bold text-[#22c55e]">{unread > 99 ? '99+' : unread}</span>
                    </div>
                  )}

                  {allLeagues.length === 1 ? (
                    /* ── Full-width single-league layout ── */
                    <div className="p-7 flex items-center gap-8">
                      {/* Avatar */}
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${
                        isOwner ? 'bg-[#e11d48]/8 border border-[#e11d48]/15' : 'bg-[#0a0a0a] border border-[#1e1e1e]'
                      }`}>
                        {l.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <span
                            className={`text-2xl leading-none ${isOwner ? 'text-[#e11d48]' : 'text-[#52525b]'}`}
                            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
                          >
                            {getInitials(l.name)}
                          </span>
                        )}
                      </div>

                      {/* Name + next event */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3
                            className="text-2xl text-[#f4f4f5] group-hover:text-white transition-colors uppercase leading-tight truncate"
                            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                          >
                            {l.name}
                          </h3>
                          {isOwner && <Crown className="w-4 h-4 text-[#e11d48]/40 shrink-0" />}
                        </div>
                        {nextEvent ? (
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 animate-pulse" />
                            <span className="truncate uppercase text-blue-400/70 text-sm" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                              {nextEvent.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-[#52525b]">No upcoming events</span>
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-8 shrink-0">
                        <div className="text-center">
                          <div
                            className={`text-4xl leading-none ${isOwner ? 'text-[#e11d48]' : 'text-[#f4f4f5]'}`}
                            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                          >
                            {acc !== null ? `${acc}%` : '—'}
                          </div>
                          <div className="text-[10px] text-[#52525b] uppercase tracking-wider mt-1">accuracy</div>
                        </div>
                        {rank && rank.of > 1 && (
                          <div className="text-center">
                            <div
                              className="text-4xl leading-none text-[#52525b]"
                              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
                            >
                              #{rank.rank}
                            </div>
                            <div className="text-[10px] text-[#3f3f46] uppercase tracking-wider mt-1">of {rank.of}</div>
                          </div>
                        )}
                      </div>

                      {/* Divider + meta */}
                      <div className="border-l border-[#1e1e1e] pl-8 shrink-0 flex flex-col gap-1.5">
                        <span className="text-sm text-[#52525b]">
                          <span className="text-[#a1a1aa] font-medium">{memberCount}</span> members
                        </span>
                        <span className="text-sm text-[#52525b]">
                          <span className="text-[#a1a1aa] font-medium">{eventCount}</span> events
                        </span>
                      </div>

                      <ChevronRight className="w-5 h-5 text-[#3f3f46] group-hover:text-[#52525b] transition-colors shrink-0" />
                    </div>
                  ) : (
                    /* ── Multi-league card layout ── */
                    <div className="p-5 flex-1 flex flex-col">
                      {/* League logo + Name */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                          isOwner ? 'bg-[#e11d48]/8 border border-[#e11d48]/15' : 'bg-[#0a0a0a] border border-[#1e1e1e]'
                        }`}>
                          {l.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={l.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            <span
                              className={`text-sm leading-none ${isOwner ? 'text-[#e11d48]' : 'text-[#52525b]'}`}
                              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
                            >
                              {getInitials(l.name)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <h3
                            className="text-base text-[#f4f4f5] group-hover:text-white transition-colors uppercase leading-tight truncate"
                            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                          >
                            {l.name}
                          </h3>
                          {isOwner && <Crown className="w-3.5 h-3.5 text-[#e11d48]/40 shrink-0" />}
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-baseline gap-5 mb-4">
                        <div>
                          <span
                            className={`text-2xl leading-none ${isOwner ? 'text-[#e11d48]' : 'text-[#f4f4f5]'}`}
                            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                          >
                            {acc !== null ? `${acc}%` : '—'}
                          </span>
                          <span className="text-[9px] text-[#52525b] uppercase tracking-wider ml-1.5">accuracy</span>
                        </div>
                        {rank && rank.of > 1 && (
                          <div>
                            <span
                              className="text-xl leading-none text-[#52525b]"
                              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
                            >
                              #{rank.rank}
                            </span>
                            <span className="text-[9px] text-[#3f3f46] uppercase tracking-wider ml-1">of {rank.of}</span>
                          </div>
                        )}
                      </div>

                      {/* Next event */}
                      {nextEvent ? (
                        <div className="flex items-center gap-1.5 mb-4">
                          <div className="w-1 h-1 rounded-full bg-blue-400 shrink-0 animate-pulse" />
                          <span className="truncate uppercase text-blue-400/70 text-xs" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                            {nextEvent.name}
                          </span>
                        </div>
                      ) : (
                        <div className="mb-4">
                          <span className="text-xs text-[#52525b]">No upcoming events</span>
                        </div>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-3 pt-3 border-t border-[#1e1e1e]/60 mt-auto">
                        <span className="text-[11px] text-[#52525b]">
                          <span className="text-[#71717a] font-medium">{memberCount}</span> members
                        </span>
                        <span className="text-[#3f3f46]">·</span>
                        <span className="text-[11px] text-[#52525b]">
                          <span className="text-[#71717a] font-medium">{eventCount}</span> events
                        </span>
                      </div>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ═══ Live Event ═══ */}
      {globalLiveEvent && (
        <section className="mb-10">
          <Link
            href={`/leagues/${globalLiveEvent.league_id}/events/${globalLiveEvent.id}/board`}
            className="group relative flex items-center gap-4 p-5 rounded-xl border border-[#e11d48]/25 hover:border-[#e11d48]/45 transition-all active:scale-[0.99] overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(225,29,72,0.07) 0%, rgba(15,4,5,0.95) 60%)' }}
          >
            {/* Subtle pulse ring behind icon */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-xl bg-[#e11d48]/20 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="relative w-11 h-11 rounded-xl bg-[#e11d48]/12 border border-[#e11d48]/25 flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#e11d48]" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse" />
                <span className="text-[10px] font-bold text-[#e11d48] uppercase tracking-[0.2em]">Live Now</span>
              </div>
              <p
                className="text-base sm:text-lg text-[#f4f4f5] uppercase truncate leading-tight group-hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
              >
                {globalLiveEvent.name}
              </p>
              <p className="text-[11px] text-[#71717a] mt-0.5">{globalLiveEvent.league_name}</p>
            </div>

            <div className="shrink-0 flex items-center gap-1.5 pl-4">
              <span className="text-[11px] font-semibold text-[#e11d48]/60 uppercase tracking-wider group-hover:text-[#e11d48] transition-colors">
                View Board
              </span>
              <ChevronRight className="w-4 h-4 text-[#e11d48]/40 group-hover:text-[#e11d48] transition-colors" />
            </div>
          </Link>
        </section>
      )}

      {/* ═══ Next Event Hero ═══ */}
      {globalNextEvent && (
        <section className="mb-10">
          <Link
            href={`/leagues/${globalNextEvent.league_id}/events/${globalNextEvent.id}/board`}
            className="group block rounded-2xl bg-[#111111] border border-[#1e1e1e] hover:border-[#27272a] transition-all active:scale-[0.99] overflow-hidden"
          >
            {/* Top bar: event + countdown */}
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">Up Next · {globalNextEvent.league_name}</p>
                  <p
                    className="text-sm text-[#f4f4f5] uppercase truncate leading-tight group-hover:text-white transition-colors"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                  >
                    {globalNextEvent.name}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl text-blue-400 leading-none" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                  <LockCountdown lockTime={globalNextEvent.start_time} variant="inline" />
                </p>
                <p className="text-[9px] text-[#52525b] uppercase tracking-wider">until lock</p>
              </div>
            </div>

            {/* Main event matchup */}
            {mainEventFight && (
              <div className="relative flex items-stretch min-h-[100px]">
                {/* Red corner */}
                <div
                  className="flex-1 flex flex-col items-center justify-center py-5 px-3"
                  style={{ background: 'linear-gradient(135deg, rgba(225,29,72,0.10) 0%, transparent 65%)' }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: 'rgba(225,29,72,0.5)' }}>Red</p>
                  <p
                    className="text-[#f4f4f5] uppercase text-center leading-none"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.1rem, 3.5vw, 1.6rem)' }}
                  >
                    {mainEventFight.red_name.split(' ').pop()}
                  </p>
                  <p className="text-[9px] text-[#52525b] mt-1 text-center leading-tight">
                    {mainEventFight.red_name.split(' ').slice(0, -1).join(' ')}
                  </p>
                </div>

                {/* Centre: VS + weight class */}
                <div className="flex flex-col items-center justify-center px-2 gap-1.5 shrink-0">
                  <div className="w-px flex-1 bg-[#1e1e1e]" />
                  <span
                    className="text-[10px] font-black text-[#3f3f46] uppercase tracking-widest"
                    style={{ fontFamily: 'var(--font-barlow)' }}
                  >
                    vs
                  </span>
                  {mainEventFight.weight_class && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider text-[#52525b] bg-[#0a0a0a] border border-[#1e1e1e]"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.1em' }}
                    >
                      {mainEventFight.weight_class}
                    </span>
                  )}
                  <div className="w-px flex-1 bg-[#1e1e1e]" />
                </div>

                {/* Blue corner */}
                <div
                  className="flex-1 flex flex-col items-center justify-center py-5 px-3"
                  style={{ background: 'linear-gradient(225deg, rgba(96,165,250,0.10) 0%, transparent 65%)' }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5 text-blue-400/50">Blue</p>
                  <p
                    className="text-[#f4f4f5] uppercase text-center leading-none"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.1rem, 3.5vw, 1.6rem)' }}
                  >
                    {mainEventFight.blue_name.split(' ').pop()}
                  </p>
                  <p className="text-[9px] text-[#52525b] mt-1 text-center leading-tight">
                    {mainEventFight.blue_name.split(' ').slice(0, -1).join(' ')}
                  </p>
                </div>
              </div>
            )}

            {/* Picks progress footer */}
            {nextFightCount > 0 && (
              <div className="px-5 py-4 border-t border-[#1a1a1a]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-[#52525b] uppercase tracking-[0.12em]">Your Picks</span>
                  <span className="text-[10px] font-bold" style={{ color: nextPicksCount === nextFightCount ? '#34d399' : '#71717a' }}>
                    {nextPicksCount} / {nextFightCount}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-[#1a1a1a] overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: nextFightCount > 0 ? `${(nextPicksCount / nextFightCount) * 100}%` : '0%',
                      background: nextPicksCount === nextFightCount
                        ? 'linear-gradient(90deg, #34d399, #10b981)'
                        : 'linear-gradient(90deg, #e11d48, #be123c)',
                    }}
                  />
                </div>
                {nextPicksCount === nextFightCount ? (
                  <p className="text-[11px] font-bold text-[#34d399] uppercase tracking-wider">✓ All picks locked in</p>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-[#52525b]">
                      {nextFightCount - nextPicksCount} fight{nextFightCount - nextPicksCount !== 1 ? 's' : ''} remaining
                    </p>
                    <p className="text-[11px] font-bold text-[#e11d48] uppercase tracking-wider group-hover:text-[#f43f5e] transition-colors">
                      Make Picks →
                    </p>
                  </div>
                )}
              </div>
            )}
          </Link>
        </section>
      )}

      {/* ═══ Last Event Recap ═══ */}
      {recentEvent && recentEventPicks.length > 0 && recentEventLeagueId && (() => {
        const scoredPicks2 = recentEventPicks.filter(p => p.fights?.result_winner != null)
        const correctCount = scoredPicks2.filter(p => p.pick_winner === p.fights!.result_winner).length
        const totalScored = scoredPicks2.length
        const accPct = totalScored > 0 ? Math.round((correctCount / totalScored) * 100) : null
        const accentColor = accPct === null ? '#3f3f46' : accPct >= 65 ? '#34d399' : accPct >= 45 ? '#f59e0b' : '#e11d48'
        return (
          <section className="mb-10">
            <details className="group/recap">
              <summary className="flex rounded-xl bg-[#111111] border border-[#1e1e1e] [details[open]>&]:rounded-b-none [details[open]>&]:border-b-[#1a1a1a] cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden overflow-hidden transition-colors hover:border-[#27272a]">
                {/* Performance accent strip */}
                <div className="w-[3px] shrink-0" style={{ background: accentColor }} />

                {/* Card body */}
                <div className="flex-1 px-4 py-3.5 min-w-0">
                  {/* Top row: label + chevron */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold text-[#3f3f46] uppercase tracking-[0.18em] mb-0.5">
                        Last Event · {leagueNameMap[recentEventLeagueId] ?? ''}
                      </p>
                      <p
                        className="text-sm text-[#d4d4d8] uppercase truncate leading-tight"
                        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                      >
                        {recentEvent.name}
                      </p>
                    </div>
                    {/* Chevron rotates when open */}
                    <ChevronRight className="w-3.5 h-3.5 text-[#3f3f46] shrink-0 mt-1 transition-transform duration-200 group-open/recap:rotate-90" />
                  </div>

                  {/* Stats row */}
                  <div className="flex items-baseline gap-3 mb-3">
                    <div>
                      <span className="text-2xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                        {recentEventScore}
                      </span>
                      <span className="text-[9px] text-[#52525b] uppercase tracking-wider ml-1">pts</span>
                    </div>
                    {recentEventRank && recentEventRank.of > 1 && (
                      <>
                        <div className="w-px h-3.5 bg-[#27272a] self-center" />
                        <div>
                          <span className="text-xl leading-none text-[#71717a]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                            #{recentEventRank.rank}
                          </span>
                          <span className="text-[9px] text-[#3f3f46] uppercase tracking-wider ml-1">of {recentEventRank.of}</span>
                        </div>
                      </>
                    )}
                    {accPct !== null && (
                      <>
                        <div className="w-px h-3.5 bg-[#27272a] self-center" />
                        <div>
                          <span className="text-xl leading-none" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, color: accentColor }}>
                            {accPct}%
                          </span>
                          <span className="text-[9px] text-[#3f3f46] uppercase tracking-wider ml-1">acc</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Segmented pick bar */}
                  <div className="flex gap-0.5">
                    {recentEventPicks.map((p) => {
                      const isCorrect = p.fights?.result_winner != null && p.pick_winner === p.fights.result_winner
                      const isWrong = p.fights?.result_winner != null && p.pick_winner !== p.fights.result_winner
                      return (
                        <div
                          key={p.fight_id}
                          className="flex-1 h-[5px] rounded-sm"
                          style={{ background: isCorrect ? '#34d399' : isWrong ? '#e11d48' : '#27272a' }}
                        />
                      )
                    })}
                  </div>
                </div>
              </summary>

              {/* ── Expanded fight breakdown ── */}
              <div className="rounded-b-xl bg-[#111111] border border-t-0 border-[#1e1e1e] overflow-hidden">
                {/* Left accent continues */}
                <div className="flex">
                  <div className="w-[3px] shrink-0" style={{ background: accentColor }} />
                  <div className="flex-1 min-w-0">
                    {/* Fight rows */}
                    {recentEventPicks.map((p, i) => {
                      const isCorrect = p.fights?.result_winner != null && p.pick_winner === p.fights.result_winner
                      const isWrong = p.fights?.result_winner != null && p.pick_winner !== p.fights.result_winner
                      const pickedName = p.pick_winner === 'red' ? (p.fights?.red_name ?? '—') : (p.fights?.blue_name ?? '—')
                      const oppName = p.pick_winner === 'red' ? (p.fights?.blue_name ?? '—') : (p.fights?.red_name ?? '—')
                      const pts = p.points_earned ?? 0
                      return (
                        <div
                          key={p.fight_id}
                          className="flex items-center gap-3 px-4 py-2.5"
                          style={{ borderTop: i === 0 ? 'none' : '1px solid #1a1a1a' }}
                        >
                          {/* Result indicator */}
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: isCorrect ? '#34d399' : isWrong ? '#e11d48' : '#27272a' }}
                          />
                          {/* Fighter picked */}
                          <div className="flex-1 min-w-0">
                            <span
                              className="text-xs uppercase leading-none"
                              style={{
                                fontFamily: 'var(--font-barlow)',
                                fontWeight: 800,
                                color: isCorrect ? '#d1fae5' : isWrong ? '#fecdd3' : '#a1a1aa',
                              }}
                            >
                              {pickedName.split(' ').pop()}
                            </span>
                            <span className="text-[10px] text-[#3f3f46] ml-1.5 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 600 }}>
                              vs {oppName.split(' ').pop()}
                            </span>
                          </div>
                          {/* Points */}
                          <div className="shrink-0 text-right">
                            {isCorrect || isWrong ? (
                              <span
                                className="text-xs font-bold"
                                style={{
                                  fontFamily: 'var(--font-barlow)',
                                  fontWeight: 800,
                                  color: pts > 0 ? '#34d399' : '#e11d48',
                                }}
                              >
                                {pts > 0 ? `+${pts}` : '0'} pts
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#3f3f46]">pending</span>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* View Board button */}
                    <div className="px-4 py-3 border-t border-[#1a1a1a]">
                      <Link
                        href={`/leagues/${recentEventLeagueId}/events/${recentEvent.id}/board`}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#e11d48] hover:text-[#f43f5e] transition-colors"
                      >
                        View Full Board
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </section>
        )
      })()}

      {/* ═══ Empty state ═══ */}
      {allLeagues.length === 0 && (
        <section className="flex flex-col items-center justify-center py-24 text-center mb-10">
          <div className="w-16 h-16 rounded-xl bg-[#111111] border border-[#1e1e1e] flex items-center justify-center mb-5">
            <Shield className="w-7 h-7 text-[#3f3f46]" />
          </div>
          <h2
            className="text-lg text-[#f4f4f5] mb-2 uppercase"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
          >
            No leagues yet
          </h2>
          <p className="text-sm text-[#71717a] max-w-sm mb-6">
            {canCreateLeague
              ? 'Create a league and invite friends to compete.'
              : 'Join a league with an invite code to start making picks.'}
          </p>
          {canCreateLeague && (
            <Link
              href="/leagues/new"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create a League
            </Link>
          )}
        </section>
      )}

      {/* ═══ Join with Code ═══ */}
      <section className="mb-10">
        <JoinWithCode />
      </section>

      {/* ═══ Create League Promo — regular players ═══ */}
      {!canCreateLeague && (
        <section>
          <div className="flex items-start gap-4 p-5 rounded-xl bg-[#111111] border border-[#1e1e1e]">
            <div className="w-11 h-11 rounded-xl bg-[#e11d48]/8 border border-[#e11d48]/15 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-5 h-5 text-[#e11d48]/50" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p
                  className="text-sm text-[#71717a] uppercase leading-tight"
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                >
                  Create Your Own League
                </p>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-[#e11d48]/70 bg-[#e11d48]/8 border border-[#e11d48]/10 uppercase tracking-wider">
                  Soon
                </span>
              </div>
              <p className="text-xs text-[#52525b] leading-relaxed">
                League creation is a premium feature rolling out soon. You&apos;ll be able to create leagues, invite friends, and run your own competitions.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
