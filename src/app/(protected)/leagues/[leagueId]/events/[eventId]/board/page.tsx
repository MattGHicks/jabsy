import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft, TrendingUp, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cn, formatDateTime, getInitials } from '@/lib/utils'
import { StickyStandings } from './sticky-standings'
import { BoardLiveUpdater } from './board-live-updater'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ leagueId: string; eventId: string }>
}

const METHOD_LABELS: Record<string, string> = {
  ko_tko: 'KO/TKO',
  submission: 'Sub',
  decision: 'Dec',
  dq: 'DQ',
  nc: 'NC',
}

type Fight = {
  id: string
  red_name: string
  blue_name: string
  bout_order: number
  is_main_event: boolean
  status: string
  result_winner: string | null
  result_method: string | null
  result_round: number | null
  scheduled_rounds: number
}

export default async function BoardPage({ params }: PageProps) {
  const { leagueId, eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, owner_id')
    .eq('id', leagueId)
    .single()
  if (!league) notFound()

  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  const isOwner = league.owner_id === user.id
  if (!isOwner && !membership) redirect('/dashboard')

  const { data: event } = await supabase
    .from('events')
    .select('*, fights(*)')
    .eq('id', eventId)
    .single()
  if (!event) notFound()

  // Auto-transition event status based on lock_time and fight results
  const lockTrigger = event.lock_time ?? event.start_time
  if (event.status === 'upcoming' && new Date() >= new Date(lockTrigger)) {
    const adminClient = createAdminClient()
    await adminClient.from('events').update({ status: 'live' }).eq('id', eventId)
    event.status = 'live'
  }
  if (event.status === 'live') {
    const allFights = (event.fights ?? []) as { status: string }[]
    const TERMINAL = ['final', 'cancelled', 'no_contest']
    if (allFights.length > 0 && allFights.every((f) => TERMINAL.includes(f.status))) {
      const adminClient = createAdminClient()
      await adminClient.from('events').update({ status: 'completed' }).eq('id', eventId)
      event.status = 'completed'
    }
  }

  const fights: Fight[] = [...((event.fights ?? []) as Fight[])].sort(
    (a, b) => a.bout_order - b.bout_order
  )

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, profiles(id, username, avatar_url)')
    .eq('league_id', leagueId)

  const profilesMap: Record<string, { username: string | null; avatar_url: string | null }> = {}
  for (const m of members ?? []) {
    if (m.profiles) {
      profilesMap[m.user_id] = m.profiles as { username: string | null; avatar_url: string | null }
    }
  }

  // Use admin client to fetch all picks — RLS hides other users' picks for upcoming events
  const adminClient = createAdminClient()
  const { data: allPicks } = await adminClient
    .from('picks')
    .select('user_id, fight_id, pick_winner, pick_method, pick_round, points_earned')
    .eq('league_id', leagueId)
    .eq('event_id', eventId)

  const picksIndex: Record<string, {
    pick_winner: string
    pick_method: string
    pick_round: number | null
    points_earned: number | null
  }> = {}
  for (const p of allPicks ?? []) {
    picksIndex[`${p.user_id}:${p.fight_id}`] = p
  }

  const memberIds = (members ?? []).map((m) => m.user_id)
  const allMemberRows = memberIds.map((uid) => {
    const profile = profilesMap[uid]
    const totalPts = fights.reduce((sum, f) => {
      const pick = picksIndex[`${uid}:${f.id}`]
      return sum + (pick?.points_earned ?? 0)
    }, 0)
    const picksSubmitted = fights.filter((f) => picksIndex[`${uid}:${f.id}`]).length
    return { uid, profile, totalPts, picksSubmitted }
  })

  // Standings: only members who have picked, sorted by points
  const leaderboard = allMemberRows
    .filter((p) => p.picksSubmitted > 0)
    .sort((a, b) => b.totalPts - a.totalPts || b.picksSubmitted - a.picksSubmitted)

  // Fight pick rows: only members who have submitted picks
  const picksRows = leaderboard

  const isLive = event.status === 'live'
  const isCompleted = event.status === 'completed'
  const maxPts = leaderboard[0]?.totalPts ?? 1

  // Winner(s): players tied at the top when event is completed
  const topScore = leaderboard[0]?.totalPts ?? 0
  const winners = isCompleted && topScore > 0
    ? leaderboard.filter((p) => p.totalPts === topScore)
    : []

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">

        {/* Top bar */}
        <div className="py-5 flex items-center justify-between gap-4">
          <Link
            href={`/leagues/${leagueId}`}
            className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 transition-all active:opacity-70"
          >
            <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
              <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
            </div>
            <div className="flex flex-col justify-center leading-none">
              <span className="text-[9px] font-semibold tracking-[0.15em] text-[#3f3f46] uppercase mb-1">League</span>
              <span
                className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}
              >
                {league.name}
              </span>
            </div>
          </Link>
          {isLive && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e11d48]/10 border border-[#e11d48]/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse" />
              <span className="text-[11px] font-bold text-[#e11d48] tracking-widest uppercase">Live</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#27272a]/60 border border-[#3f3f46]/40 shrink-0">
              <span className="text-[11px] font-bold text-[#71717a] tracking-widest uppercase">Final</span>
            </div>
          )}
        </div>

        {/* Event heading */}
        <div className="mb-8 pb-8 border-b border-[#141414]">
          <h1
            className="text-[#f4f4f5] uppercase leading-none mb-2"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2rem, 9vw, 3.5rem)' }}
          >
            {event.name}
          </h1>
          <p className="text-sm text-[#52525b]">
            {formatDateTime(event.start_time)}
            {event.venue ? ` · ${event.venue}` : ''}
          </p>
        </div>

        {/* ── Winner callout ──────────────────────────────────────── */}
        {winners.length > 0 && (
          <div className="mb-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/[0.04] px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-[10px] font-bold tracking-widest text-yellow-500/70 uppercase">
                {winners.length === 1 ? 'Winner' : 'Tied for the Win'}
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
              {winners.map(({ uid, profile }) => (
                <div key={uid} className="flex items-center gap-2">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden border shrink-0',
                    uid === user.id
                      ? 'bg-[#e11d48]/20 border-[#e11d48]/40 text-[#e11d48]'
                      : 'bg-[#1e1e1e] border-[#27272a] text-[#71717a]'
                  )}>
                    {profile?.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      : getInitials(profile?.username ?? 'U')}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#f4f4f5]">{profile?.username ?? 'Unknown'}</p>
                    <p className="text-[10px] text-yellow-500/60">
                      <span style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>{topScore}</span> pts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Standings ───────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-3.5 h-3.5 text-[#52525b]" />
            <span className="text-[10px] font-bold tracking-widest text-[#52525b] uppercase">Standings</span>
          </div>

          <StickyStandings
            leaderboard={leaderboard}
            currentUserId={user.id}
            maxPts={maxPts}
            isLive={isLive}
            isCompleted={isCompleted}
          />
          <BoardLiveUpdater eventId={eventId} isLive={isLive} />
        </section>

        {/* ── Picks by fight ──────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold tracking-widest text-[#52525b] uppercase">Fight Picks</span>
          </div>

          <div className="flex flex-col gap-3">
            {fights.map((fight) => {
              const isCancelled = fight.status === 'cancelled'
              // no_contest is treated same as final — result_winner/method will be set to 'nc'
              const isFinal = fight.status === 'final' || fight.status === 'no_contest'
              const result = fight.result_winner
              const resultName =
                result === 'red' ? fight.red_name :
                result === 'blue' ? fight.blue_name : null

              return (
                <div
                  key={fight.id}
                  className={cn(
                    'rounded-2xl overflow-hidden border',
                    isCancelled ? 'border-[#161616] opacity-40' :
                    isFinal ? 'border-[#1e1e1e]' : 'border-[#161616]'
                  )}
                >
                  {/* ── Fight header ── */}
                  <div className={cn('px-4 py-3.5', isCancelled ? 'bg-[#0d0d0d]' : 'bg-[#111111]')}>
                    {fight.is_main_event && (
                      <p className="text-[9px] font-bold tracking-widest text-[#e11d48] uppercase mb-2">
                        ★ Main Event
                      </p>
                    )}
                    <div className="flex items-start justify-between gap-4">
                      {/* Fighters */}
                      <div>
                        <p className={cn('text-sm font-bold leading-tight', isCancelled ? 'text-[#52525b]' : 'text-[#e11d48]')}>
                          {fight.red_name}
                        </p>
                        <p className="text-[9px] text-[#3f3f46] font-bold my-1 tracking-widest uppercase">vs</p>
                        <p className={cn('text-sm font-bold leading-tight', isCancelled ? 'text-[#52525b]' : 'text-blue-400')}>
                          {fight.blue_name}
                        </p>
                      </div>

                      {/* Result or status pill */}
                      {isCancelled ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a1a1a] border border-[#222] self-center shrink-0">
                          <span className="text-[10px] font-bold text-[#3f3f46] tracking-widest uppercase">Cancelled</span>
                        </div>
                      ) : isFinal ? (
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-bold tracking-widest text-[#52525b] uppercase mb-1">Result</p>
                          <p className={cn(
                            'text-sm font-bold leading-tight',
                            result === 'red' ? 'text-[#e11d48]'
                              : result === 'blue' ? 'text-blue-400'
                              : 'text-[#71717a]'
                          )}>
                            {resultName?.split(' ').pop() ?? (result === 'draw' ? 'Draw' : 'NC')}
                          </p>
                          <p className="text-[10px] text-[#52525b] mt-0.5">
                            {fight.result_method ? METHOD_LABELS[fight.result_method] : ''}
                            {fight.result_round ? ` · R${fight.result_round}` : ''}
                          </p>
                        </div>
                      ) : fight.status === 'live' ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e11d48]/10 border border-[#e11d48]/20 self-center shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse" />
                          <span className="text-[10px] font-bold text-[#e11d48] tracking-widest uppercase">Live</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1e1e1e] border border-[#27272a] self-center shrink-0">
                          <span className="text-[10px] font-bold text-[#52525b] tracking-widest uppercase">Pending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Player pick rows — hidden for cancelled fights ── */}
                  {!isCancelled && <div className="bg-[#0d0d0d] divide-y divide-[#111111]">
                    {picksRows.map(({ uid, profile }, pidx) => {
                      const pick = picksIndex[`${uid}:${fight.id}`]
                      const isMe = uid === user.id
                      const rank = pidx + 1

                      const correctWinner = isFinal && !!result && pick?.pick_winner === result
                      const pts = pick?.points_earned ?? 0

                      return (
                        <div
                          key={uid}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5 transition-colors',
                            correctWinner ? 'bg-green-500/[0.06]' : '',
                          )}
                        >
                          {/* Avatar */}
                          <div className={cn(
                            'w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 border overflow-hidden',
                            isMe
                              ? 'bg-[#e11d48]/20 border-[#e11d48]/30 text-[#e11d48]'
                              : 'bg-[#1a1a1a] border-[#222] text-[#52525b]'
                          )}>
                            {profile?.avatar_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                              : getInitials(profile?.username ?? 'U')}
                          </div>

                          {/* Name */}
                          <span className="text-xs font-semibold flex-1 min-w-0 truncate text-[#71717a]">
                            {profile?.username?.split(' ')[0] ?? '?'}
                          </span>

                          {/* Pick + Points (right side) */}
                          <div className="flex items-center gap-2 shrink-0">
                            {pick ? (
                              <>
                                <span className={cn(
                                  'text-xs font-bold',
                                  pick.pick_winner === 'red' ? 'text-[#e11d48]' : 'text-blue-400',
                                  isFinal && !correctWinner && 'opacity-20'
                                )}>
                                  {(pick.pick_winner === 'red' ? fight.red_name : fight.blue_name).split(' ').pop()}
                                </span>
                                <span className={cn(
                                  'text-xs',
                                  isFinal
                                    ? correctWinner
                                      ? 'text-[#71717a]'
                                      : 'text-[#3f3f46]'
                                    : 'text-[#71717a]'
                                )}>
                                  {METHOD_LABELS[pick.pick_method] ?? pick.pick_method}
                                  {pick.pick_round ? ` R${pick.pick_round}` : ''}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] text-[#3f3f46]">—</span>
                            )}
                            {isFinal && pick && (
                              <div className="w-8 text-right shrink-0">
                                <span
                                  className={cn(
                                    'text-xs font-bold tabular-nums',
                                    pts > 0 ? 'text-green-400' : 'text-[#3f3f46]'
                                  )}
                                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                                >
                                  {pts > 0 ? `+${pts}` : '0'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>}
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
