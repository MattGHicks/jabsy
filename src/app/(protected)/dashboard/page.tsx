import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Users, Calendar, Crown, Shield, Zap, Target, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate, getInitials } from '@/lib/utils'
import { JoinWithCode } from './join-with-code'

export const dynamic = 'force-dynamic'

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
  let nextEvents: Record<string, { name: string; start_time: string } | null> = {}

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
  // Use points_earned to derive stats: null = not yet scored, >=5 = correct winner, <5 = wrong winner
  const { data: myPicks } = await supabase
    .from('picks')
    .select('points_earned')
    .eq('user_id', user.id)

  const scoredPicks = (myPicks ?? []).filter((p) => p.points_earned !== null)
  const totalPts = scoredPicks.reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
  // Correct winner = points_earned >= 5
  const correctPicks = scoredPicks.filter((p) => (p.points_earned ?? 0) >= 5)
  const accuracy = scoredPicks.length > 0 ? Math.round((correctPicks.length / scoredPicks.length) * 100) : null
  const totalPicksMade = (myPicks ?? []).length

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
            MY LEAGUES
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

      {/* League grid */}
      {allLeagues.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {allLeagues.map((league) => {
            const l = league as { id: string; name: string; created_at: string; description?: string | null; _role: string }
            const isOwner = l._role === 'owner' || l._role === 'admin'
            const memberCount = memberCounts[l.id] ?? 0
            const eventCount = eventCounts[l.id] ?? 0
            const nextEvent = nextEvents[l.id]
            const avatarInitials = getInitials(l.name)

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
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold shrink-0 ${
                    isOwner
                      ? 'bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20'
                      : 'bg-[#1e1e1e] text-[#71717a] border border-[#27272a]'
                  }`}>
                    {isOwner ? <Crown className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {isOwner ? 'Owner' : 'Member'}
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
      )}

      {/* Join with invite code */}
      <JoinWithCode />

      {/* Personal Stats — below league list */}
      {totalPicksMade > 0 && (
        <div className="mt-10 pt-8 border-t border-[#1a1a1a]">
          <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-widest mb-3">Your Stats</p>

          {/* Mobile: single-card strip with dividers */}
          <div className="sm:hidden flex items-stretch rounded-xl bg-[#141414] border border-[#1e1e1e] overflow-hidden">
            <div className="flex-1 flex flex-col items-center justify-center py-4 px-2">
              <p className="text-2xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{totalPts}</p>
              <p className="text-[10px] text-[#52525b] uppercase tracking-wider mt-1.5">Pts</p>
            </div>
            <div className="w-px bg-[#1e1e1e]" />
            <div className="flex-1 flex flex-col items-center justify-center py-4 px-2">
              <p className="text-2xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                {accuracy !== null ? `${accuracy}%` : '—'}
              </p>
              <p className="text-[10px] text-[#52525b] uppercase tracking-wider mt-1.5">Accuracy</p>
            </div>
            <div className="w-px bg-[#1e1e1e]" />
            <div className="flex-1 flex flex-col items-center justify-center py-4 px-2">
              <p className="text-2xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{totalPicksMade}</p>
              <p className="text-[10px] text-[#52525b] uppercase tracking-wider mt-1.5">Picks</p>
            </div>
          </div>

          {/* Desktop: 3-card grid with icons */}
          <div className="hidden sm:grid grid-cols-3 gap-3">
            <div className="p-4 rounded-lg bg-[#141414] border border-[#1e1e1e] flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-[#e11d48]" />
              </div>
              <div>
                <p className="text-xs text-[#71717a] uppercase tracking-wider leading-none mb-1">Total Pts</p>
                <p className="text-xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{totalPts}</p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-[#141414] border border-[#1e1e1e] flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-[#71717a] uppercase tracking-wider leading-none mb-1">Accuracy</p>
                <p className="text-xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                  {accuracy !== null ? `${accuracy}%` : '—'}
                </p>
              </div>
            </div>
            <div className="p-4 rounded-lg bg-[#141414] border border-[#1e1e1e] flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-[#a1a1aa]" />
              </div>
              <div>
                <p className="text-xs text-[#71717a] uppercase tracking-wider leading-none mb-1">Picks Made</p>
                <p className="text-xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{totalPicksMade}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
