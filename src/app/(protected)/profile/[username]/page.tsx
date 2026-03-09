import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, Zap, Target, TrendingUp, Trophy, Award, Users, Crown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInitials } from '@/lib/utils'
import { calcWeightedAccuracy } from '@/lib/accuracy'
import { AccuracyInfo } from '@/components/accuracy-info'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ username: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function PublicProfilePage({ params, searchParams }: PageProps) {
  const { username } = await params
  const { from: fromLeagueId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find profile by username (case-insensitive)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, role, created_at')
    .ilike('username', username)
    .single()

  if (!profile) notFound()

  const isOwnProfile = profile.id === user.id

  // If viewing own profile redirect to the edit page
  if (isOwnProfile) redirect('/profile')

  // ── Stats queries ──
  const { data: allPicks } = await supabase
    .from('picks')
    .select('points_earned, event_id, league_id, fights!inner(result_method, result_winner)')
    .eq('user_id', profile.id)

  type FightJoin = { result_method: string; result_winner: string | null }
  const scoredPicks = (allPicks ?? []).filter((p) => p.points_earned !== null)
  const totalPts = scoredPicks.reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
  const accuracy = calcWeightedAccuracy(
    scoredPicks.map((p) => {
      const f = p.fights as unknown as FightJoin
      return { points_earned: p.points_earned, result_method: f.result_method, result_winner: f.result_winner }
    })
  )
  const totalPicksMade = (allPicks ?? []).length

  // Best single-event score
  const eventScores: Record<string, number> = {}
  for (const p of scoredPicks) {
    eventScores[p.event_id] = (eventScores[p.event_id] ?? 0) + (p.points_earned ?? 0)
  }
  const bestEventScore = Object.values(eventScores).length > 0
    ? Math.max(...Object.values(eventScores))
    : null

  // Get leagues they're in
  const { data: theirLeagues } = await supabase
    .from('league_members')
    .select('league_id, role, leagues(id, name, owner_id, avatar_url)')
    .eq('user_id', profile.id)

  const { data: theirOwnedLeagues } = await supabase
    .from('leagues')
    .select('id, name, owner_id, avatar_url')
    .eq('owner_id', profile.id)

  type LeagueJoin = { id: string; name: string; owner_id: string; avatar_url: string | null }
  const memberLeagueIds = new Set((theirLeagues ?? []).map((l) => l.league_id))
  const ownedLeagues = (theirOwnedLeagues ?? []).filter((l) => !memberLeagueIds.has(l.id)).map((l) => ({
    id: l.id, name: l.name, isOwner: true, avatar_url: l.avatar_url
  }))
  const memberLeagues = (theirLeagues ?? []).map((l) => ({
    id: l.league_id,
    name: (l.leagues as LeagueJoin | null)?.name ?? '',
    isOwner: l.role === 'admin' || (l.leagues as LeagueJoin | null)?.owner_id === profile.id,
    avatar_url: (l.leagues as LeagueJoin | null)?.avatar_url ?? null,
  }))
  const allLeagues = [...ownedLeagues, ...memberLeagues].filter((l) => l.name)
  const leagueIds = allLeagues.map((l) => l.id)

  // Win rate
  let winCount = 0
  if (leagueIds.length > 0) {
    const { data: allLeaguePicks } = await supabase
      .from('picks')
      .select('league_id, user_id, points_earned')
      .in('league_id', leagueIds)

    const leagueTotals: Record<string, Record<string, number>> = {}
    for (const p of allLeaguePicks ?? []) {
      if (!leagueTotals[p.league_id]) leagueTotals[p.league_id] = {}
      leagueTotals[p.league_id][p.user_id] = (leagueTotals[p.league_id][p.user_id] ?? 0) + (p.points_earned ?? 0)
    }
    for (const lid of leagueIds) {
      const totals = leagueTotals[lid] ?? {}
      const maxPts = Math.max(...Object.values(totals), 0)
      if (maxPts > 0 && (totals[profile.id] ?? 0) === maxPts) winCount++
    }
  }
  // Fetch the league name for the back button if `from` is present
  let fromLeagueName: string | null = null
  if (fromLeagueId) {
    const { data: fromLeague } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', fromLeagueId)
      .single()
    fromLeagueName = fromLeague?.name ?? null
  }

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin',
    league_owner: 'League Owner',
    player: 'Player',
  }

  const stats = [
    { label: 'Total Points', value: totalPts > 0 ? `${totalPts}` : '—', icon: Zap, accent: '#e11d48', accentBg: 'rgba(225,29,72,0.08)', accentBorder: 'rgba(225,29,72,0.15)' },
    { label: 'Accuracy', value: accuracy !== null ? `${accuracy}%` : '—', icon: Target, accent: '#60a5fa', accentBg: 'rgba(96,165,250,0.08)', accentBorder: 'rgba(96,165,250,0.15)' },
    { label: 'Total Picks', value: totalPicksMade > 0 ? `${totalPicksMade}` : '—', icon: TrendingUp, accent: '#71717a', accentBg: 'rgba(113,113,122,0.08)', accentBorder: 'rgba(113,113,122,0.15)' },
    { label: 'Best Event', value: bestEventScore !== null ? `${bestEventScore}` : '—', icon: Trophy, accent: '#fbbf24', accentBg: 'rgba(251,191,36,0.08)', accentBorder: 'rgba(251,191,36,0.15)' },
    { label: 'Total Wins', value: winCount > 0 ? `${winCount}` : '—', icon: Award, accent: '#34d399', accentBg: 'rgba(52,211,153,0.08)', accentBorder: 'rgba(52,211,153,0.15)' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back button */}
      {fromLeagueId && (
        <div className="mb-6">
          <Link
            href={`/leagues/${fromLeagueId}`}
            className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 w-fit transition-all active:opacity-70"
          >
            <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
              <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
            </div>
            <div className="flex flex-col justify-center leading-none">
              <span className="text-[9px] font-semibold tracking-[0.15em] text-[#52525b] uppercase mb-1">League</span>
              <span
                className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}
              >
                {fromLeagueName ?? 'Back'}
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* ── Header ───────────────────────────────────── */}
      <div className="flex items-center gap-5 sm:gap-6 mb-10">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#1e1e1e] border-2 border-[#27272a] overflow-hidden shrink-0 flex items-center justify-center">
          {profile.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.avatar_url} alt={profile.username ?? ''} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            : <span className="text-3xl font-black text-[#52525b]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
                {getInitials(profile.username ?? 'U')}
              </span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <h1
            className="text-[#f4f4f5] uppercase leading-tight mb-1.5"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 3rem)' }}
          >
            {profile.username}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
            {memberSince && (
              <span className="text-[11px] text-[#52525b]">
                Joined {memberSince}
              </span>
            )}
            <span className="text-[11px] text-[#52525b]">
              · {allLeagues.length} {allLeagues.length === 1 ? 'league' : 'leagues'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Stats hero ───────────────────────────────── */}
      <div className="mb-10">
        {/* Mobile: 3 top + 2 bottom */}
        <div className="sm:hidden flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            {stats.slice(0, 3).map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-[#111111] border border-[#1e1e1e]"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: stat.accentBg, border: `1px solid ${stat.accentBorder}` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: stat.accent }} />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl leading-none text-[#f4f4f5] mb-1" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                      {stat.value}
                    </p>
                    <p className="text-[9px] text-[#52525b] uppercase tracking-[0.12em]">{stat.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {stats.slice(3).map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl bg-[#111111] border border-[#1e1e1e]"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: stat.accentBg, border: `1px solid ${stat.accentBorder}` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: stat.accent }} />
                  </div>
                  <div className="text-center">
                    <p className="text-2xl leading-none text-[#f4f4f5] mb-1" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                      {stat.value}
                    </p>
                    <p className="text-[9px] text-[#52525b] uppercase tracking-[0.12em]">{stat.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Desktop: 5-col */}
        <div className="hidden sm:grid sm:grid-cols-5 gap-2.5">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-2 py-5 px-3 rounded-xl bg-[#111111] border border-[#1e1e1e]"
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: stat.accentBg, border: `1px solid ${stat.accentBorder}` }}
                >
                  <Icon className="w-5 h-5" style={{ color: stat.accent }} />
                </div>
                <div className="text-center">
                  <p className="text-3xl leading-none text-[#f4f4f5] mb-1" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-[#52525b] uppercase tracking-[0.12em]">{stat.label}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex justify-end">
          <AccuracyInfo />
        </div>
      </div>

      {/* ── Leagues ──────────────────────────────────── */}
      {allLeagues.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Leagues
          </p>
          <div className="flex flex-col gap-2">
            {allLeagues.map((league) => (
              <div
                key={league.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111111] border border-[#1e1e1e]"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden ${league.isOwner ? 'bg-[#e11d48]/10 border border-[#e11d48]/20' : 'bg-[#1e1e1e] border border-[#27272a]'}`}>
                  {league.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={league.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : league.isOwner ? (
                    <Crown className="w-3.5 h-3.5 text-[#e11d48]" />
                  ) : (
                    <Users className="w-3.5 h-3.5 text-[#52525b]" />
                  )}
                </div>
                <p className="text-sm font-semibold text-[#a1a1aa] uppercase flex-1 truncate" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                  {league.name}
                </p>
                {league.isOwner && (
                  <span className="text-[10px] text-[#e11d48] font-semibold shrink-0">Owner</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
