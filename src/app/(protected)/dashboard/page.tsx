import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Users, Calendar, Crown, Shield, Zap, Target, TrendingUp, Trophy, Award, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate, getInitials } from '@/lib/utils'
import { JoinWithCode } from './join-with-code'

export const dynamic = 'force-dynamic'

function getTimeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return 'Now'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Leagues I own
  const { data: ownedLeagues } = await supabase
    .from('leagues')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Leagues I'm a member of (not owner)
  const { data: memberships } = await supabase
    .from('league_members')
    .select('league_id, role, leagues(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

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
  let nextEvents: Record<string, { name: string; start_time: string }> = {}

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

    // Find next upcoming event per league
    for (const le of upcomingEventsRes.data ?? []) {
      const ev = le.events as { id: string; name: string; start_time: string; status: string } | null
      if (ev && ev.status === 'upcoming' && !nextEvents[le.league_id]) {
        nextEvents[le.league_id] = { name: ev.name, start_time: ev.start_time }
      }
    }
  }

  // Personal stats — my picks across all leagues
  const { data: myPicks } = await supabase
    .from('picks')
    .select('points_earned, event_id, league_id')
    .eq('user_id', user.id)

  const scoredPicks = (myPicks ?? []).filter((p) => p.points_earned !== null)
  const totalPts = scoredPicks.reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
  const correctPicks = scoredPicks.filter((p) => (p.points_earned ?? 0) >= 5)
  const accuracy = scoredPicks.length > 0 ? Math.round((correctPicks.length / scoredPicks.length) * 100) : null
  const totalPicksMade = (myPicks ?? []).length

  // Best single-event score
  const eventScores: Record<string, number> = {}
  for (const p of scoredPicks) {
    eventScores[p.event_id] = (eventScores[p.event_id] ?? 0) + (p.points_earned ?? 0)
  }
  const bestEventScore = Object.values(eventScores).length > 0
    ? Math.max(...Object.values(eventScores))
    : null

  // League rankings — all picks in user's leagues grouped by (league_id, user_id)
  let userRanks: Record<string, { rank: number; total: number; of: number }> = {}
  if (leagueIds.length > 0) {
    const { data: allLeaguePicks } = await supabase
      .from('picks')
      .select('league_id, user_id, points_earned')
      .in('league_id', leagueIds)

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

  // Win rate — leagues where user is #1
  const rankedLeagues = Object.values(userRanks).filter((r) => r.of > 1)
  const winCount = rankedLeagues.filter((r) => r.rank === 1 && r.total > 0).length
  const winRate = rankedLeagues.length > 0 ? Math.round((winCount / rankedLeagues.length) * 100) : null

  // Global next event — soonest upcoming across all leagues
  const leagueNameMap: Record<string, string> = {}
  for (const l of allLeagues) {
    const league = l as { id: string; name: string }
    leagueNameMap[league.id] = league.name
  }
  let globalNextEvent: { name: string; start_time: string; league_name: string; league_id: string } | null = null
  for (const [lid, ev] of Object.entries(nextEvents)) {
    if (!globalNextEvent || new Date(ev.start_time) < new Date(globalNextEvent.start_time)) {
      globalNextEvent = { ...ev, league_name: leagueNameMap[lid] ?? '', league_id: lid }
    }
  }

  const canCreateLeague = profile?.role === 'admin'

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-[#e11d48] uppercase tracking-widest mb-1">
            Welcome back, {profile?.username}
          </p>
          <h1
            className="leading-none text-[#f4f4f5] uppercase"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            MY DASHBOARD
          </h1>
        </div>
        {canCreateLeague && (
          <Link
            href="/leagues/new"
            className="btn-glow inline-flex items-center gap-2 h-10 px-4 rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create League
          </Link>
        )}
      </div>

      {/* ── Stats Hero ── */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-widest mb-3">Your Stats</p>

        {/* Mobile: 3+2 grid */}
        <div className="sm:hidden grid grid-cols-3 gap-2">
          {[
            { label: 'Points', value: totalPts > 0 ? totalPts.toString() : '—', icon: Zap, color: 'text-[#e11d48]', bg: 'bg-[#e11d48]/10', border: 'border-[#e11d48]/20' },
            { label: 'Accuracy', value: accuracy !== null ? `${accuracy}%` : '—', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { label: 'Picks', value: totalPicksMade > 0 ? totalPicksMade.toString() : '—', icon: TrendingUp, color: 'text-[#a1a1aa]', bg: 'bg-zinc-800', border: 'border-zinc-700' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center py-4 px-2 rounded-xl bg-[#141414] border border-[#1e1e1e]">
              <div className={`w-7 h-7 rounded-md ${s.bg} border ${s.border} flex items-center justify-center mb-2`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
              <p className="text-xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{s.value}</p>
              <p className="text-[9px] text-[#52525b] uppercase tracking-wider mt-1.5">{s.label}</p>
            </div>
          ))}
          <div className="col-span-3 grid grid-cols-2 gap-2">
            {[
              { label: 'Best Event', value: bestEventScore !== null ? bestEventScore.toString() : '—', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
              { label: 'Win Rate', value: winRate !== null ? `${winRate}%` : '—', icon: Award, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center py-4 px-2 rounded-xl bg-[#141414] border border-[#1e1e1e]">
                <div className={`w-7 h-7 rounded-md ${s.bg} border ${s.border} flex items-center justify-center mb-2`}>
                  <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                </div>
                <p className="text-xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{s.value}</p>
                <p className="text-[9px] text-[#52525b] uppercase tracking-wider mt-1.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: 5-col */}
        <div className="hidden sm:grid grid-cols-5 gap-3">
          {[
            { label: 'Total Points', value: totalPts > 0 ? totalPts.toString() : '—', icon: Zap, color: 'text-[#e11d48]', bg: 'bg-[#e11d48]/10', border: 'border-[#e11d48]/20' },
            { label: 'Accuracy', value: accuracy !== null ? `${accuracy}%` : '—', icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { label: 'Picks Made', value: totalPicksMade > 0 ? totalPicksMade.toString() : '—', icon: TrendingUp, color: 'text-[#a1a1aa]', bg: 'bg-zinc-800', border: 'border-zinc-700' },
            { label: 'Best Event', value: bestEventScore !== null ? bestEventScore.toString() : '—', icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
            { label: 'Win Rate', value: winRate !== null ? `${winRate}%` : '—', icon: Award, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-xl bg-[#141414] border border-[#1e1e1e] flex items-center gap-3">
              <div className={`w-8 h-8 rounded-md ${s.bg} border ${s.border} flex items-center justify-center shrink-0`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-[10px] text-[#52525b] uppercase tracking-wider leading-none mb-1">{s.label}</p>
                <p className="text-xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Next Event Card ── */}
      {globalNextEvent && (
        <Link
          href={`/leagues/${globalNextEvent.league_id}`}
          className="group block mb-8 p-4 sm:p-5 rounded-xl bg-gradient-to-r from-blue-500/[0.06] to-[#141414] border border-blue-500/15 hover:border-blue-500/30 transition-all"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-blue-400/50 uppercase tracking-widest mb-0.5">Up Next</p>
              <p
                className="text-base sm:text-lg text-blue-400 uppercase truncate leading-tight group-hover:text-blue-300 transition-colors"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
              >
                {globalNextEvent.name}
              </p>
              <p className="text-[11px] text-[#52525b] mt-0.5">{globalNextEvent.league_name}</p>
            </div>
            <div className="text-right shrink-0">
              <p
                className="text-xl sm:text-2xl text-blue-400 leading-none"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
              >
                {getTimeUntil(globalNextEvent.start_time)}
              </p>
              <p className="text-[9px] text-blue-400/40 uppercase tracking-wider mt-1">until lock</p>
            </div>
          </div>
        </Link>
      )}

      {/* ── My Leagues Section ── */}
      {allLeagues.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <p
              className="text-[#71717a] uppercase"
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.08em' }}
            >
              My Leagues
            </p>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#52525b] bg-[#1a1a1a] border border-[#1e1e1e]">
              {allLeagues.length}
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allLeagues.map((league) => {
              const l = league as { id: string; name: string; created_at: string; description?: string | null; _role: string }
              const isOwner = l._role === 'owner' || l._role === 'admin'
              const memberCount = memberCounts[l.id] ?? 0
              const eventCount = eventCounts[l.id] ?? 0
              const nextEvent = nextEvents[l.id]
              const avatarInitials = getInitials(l.name)
              const rank = userRanks[l.id]

              // Rank badge styling
              const rankColor = rank
                ? rank.rank === 1 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                : rank.rank === 2 ? 'text-zinc-300 bg-zinc-500/10 border-zinc-500/20'
                : rank.rank === 3 ? 'text-orange-400 bg-orange-500/10 border-orange-500/20'
                : 'text-[#52525b] bg-[#1a1a1a] border-[#27272a]'
                : null

              return (
                <Link
                  key={l.id}
                  href={`/leagues/${l.id}`}
                  className={`card-lift group relative flex flex-col p-5 rounded-xl bg-[#141414] border overflow-hidden ${
                    isOwner
                      ? 'border-[#e11d48]/20 hover:border-[#e11d48]/35'
                      : 'border-[#1e1e1e] hover:border-[#27272a]'
                  }`}
                >
                  {/* Left accent stripe */}
                  <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isOwner ? 'bg-[#e11d48]' : 'bg-[#27272a]'}`} />

                  {/* Top row: avatar + name + badge */}
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isOwner ? 'bg-[#e11d48]/15 border border-[#e11d48]/30' : 'bg-[#1e1e1e] border border-[#27272a]'}`}>
                      <span
                        className={`text-sm font-bold ${isOwner ? 'text-[#e11d48]' : 'text-[#71717a]'}`}
                        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                      >
                        {avatarInitials}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-base font-bold text-[#f4f4f5] group-hover:text-white transition-colors uppercase leading-tight truncate"
                        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                      >
                        {l.name}
                      </h3>
                      <p className="text-[11px] text-[#52525b] mt-0.5">Created {formatDate(l.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Rank badge */}
                      {rank && rankColor && (
                        <div className={`inline-flex items-center px-1.5 py-1 rounded-md text-[11px] font-bold border ${rankColor}`}
                          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                        >
                          #{rank.rank}
                        </div>
                      )}
                      {/* Role badge */}
                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold ${
                        isOwner
                          ? 'bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20'
                          : 'bg-[#1e1e1e] text-[#71717a] border border-[#27272a]'
                      }`}>
                        {isOwner ? <Crown className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {isOwner ? 'Owner' : 'Member'}
                      </div>
                    </div>
                  </div>

                  {/* Next event pill */}
                  {nextEvent ? (
                    <div className="mb-4 flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-blue-500/6 border border-blue-500/15">
                      <Calendar className="w-3 h-3 shrink-0 text-blue-400/70" />
                      <span className="truncate uppercase text-blue-400 text-sm" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                        {nextEvent.name}
                      </span>
                      <span className="ml-auto text-blue-400/50 shrink-0 text-[10px] uppercase tracking-wide">upcoming</span>
                    </div>
                  ) : (
                    <div className="mb-4" />
                  )}

                  <div className="flex items-center gap-4 pt-3 border-t border-[#1e1e1e] mt-auto">
                    <div className="flex items-center gap-1.5 text-xs text-[#71717a]">
                      <Users className="w-3.5 h-3.5" />
                      {memberCount} {memberCount === 1 ? 'member' : 'members'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[#71717a]">
                      <Calendar className="w-3.5 h-3.5" />
                      {eventCount} {eventCount === 1 ? 'event' : 'events'}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {allLeagues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1e1e1e] border border-[#27272a] flex items-center justify-center mb-5">
            <Shield className="w-7 h-7 text-[#52525b]" />
          </div>
          <h2 className="text-lg font-semibold text-[#f4f4f5] mb-2">No leagues yet</h2>
          <p className="text-sm text-[#71717a] max-w-sm mb-6">
            {canCreateLeague
              ? 'Create a league and invite friends to compete.'
              : 'Ask someone to share an invite link with you to join a league.'}
          </p>
          {canCreateLeague && (
            <Link
              href="/leagues/new"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create a League
            </Link>
          )}
        </div>
      )}

      {/* Join with invite code */}
      <JoinWithCode />
    </div>
  )
}
