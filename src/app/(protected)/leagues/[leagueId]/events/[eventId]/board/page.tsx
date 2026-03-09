import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft, TrendingUp, Trophy, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cn, formatDateTime, getInitials, getLastName } from '@/lib/utils'
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
  red_sherdog_url: string | null
  blue_sherdog_url: string | null
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
              <span className="text-[9px] font-semibold tracking-[0.15em] text-[#52525b] uppercase mb-1">League</span>
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
        <div className="mb-10">
          <p className="text-[10px] font-semibold text-[#e11d48] uppercase tracking-[0.2em] mb-1.5">
            Leaderboard
          </p>
          <h1
            className="text-[#f4f4f5] uppercase leading-[0.9]"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2.2rem, 8vw, 3.5rem)' }}
          >
            {event.name}
          </h1>
          <p className="text-[11px] text-[#52525b] mt-2">
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
              {winners.map(({ uid, profile }) => {
                const winnerHref = uid === user.id
                  ? '/profile'
                  : profile?.username
                  ? `/profile/${encodeURIComponent(profile.username)}?from=${leagueId}`
                  : '#'
                return (
                  <Link key={uid} href={winnerHref} className="flex items-center gap-2 group hover:opacity-80 transition-opacity">
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
                      <p className="text-sm font-bold text-[#f4f4f5] group-hover:text-white transition-colors">{profile?.username ?? 'Unknown'}</p>
                      <p className="text-[10px] text-yellow-500/60">
                        <span style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>{topScore}</span> pts
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Standings ───────────────────────────────────────────── */}
        {leaderboard.length > 0 ? (
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
              leagueId={leagueId}
            />
            <BoardLiveUpdater eventId={eventId} isLive={isLive} />
          </section>
        ) : (
          <section className="mb-10">
            <div className="flex flex-col items-center py-12 text-center rounded-xl border border-dashed border-[#1e1e1e]">
              <TrendingUp className="w-6 h-6 text-[#3f3f46] mb-3" />
              <p className="text-sm text-[#52525b]">No picks submitted yet</p>
              <p className="text-xs text-[#3f3f46] mt-1">
                Standings will appear once members start making picks.
              </p>
              {!isLive && !isCompleted && (
                <Link
                  href={`/leagues/${leagueId}/events/${eventId}`}
                  className="mt-4 inline-flex items-center gap-1.5 h-8 px-4 rounded-lg bg-[#e11d48] text-white text-xs font-semibold hover:bg-[#be123c] transition-colors"
                >
                  Make Your Picks
                </Link>
              )}
            </div>
          </section>
        )}

        {/* ── Picks by fight ──────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold tracking-widest text-[#52525b] uppercase">Fight Picks</span>
          </div>

          <div className="flex flex-col gap-4">
            {fights.map((fight) => {
              const isCancelled = fight.status === 'cancelled'
              const isFinal = fight.status === 'final' || fight.status === 'no_contest'
              const result = fight.result_winner
              const resultName =
                result === 'red' ? fight.red_name :
                result === 'blue' ? fight.blue_name : null

              return (
                <div
                  key={fight.id}
                  className={cn(
                    'rounded-xl overflow-hidden border',
                    isCancelled ? 'border-[#161616] opacity-40' :
                    isFinal ? 'border-[#1e1e1e]' : 'border-[#1a1a1a]'
                  )}
                >
                  {/* ── Fight header ── */}
                  <div className={cn(
                    'px-5 py-4',
                    isCancelled ? 'bg-[#0d0d0d]' : 'bg-[#111111]'
                  )}>
                    {fight.is_main_event && (
                      <p className="text-[9px] font-bold tracking-widest text-[#e11d48] uppercase mb-2.5">
                        ★ Main Event
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      {/* Fighters */}
                      <div className="flex-1 min-w-0">
                        {fight.red_sherdog_url ? (
                          <a
                            href={fight.red_sherdog_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn('group/red flex items-center gap-1.5 w-fit', isCancelled && 'pointer-events-none')}
                          >
                            <p
                              className={cn('leading-tight uppercase truncate group-hover/red:underline decoration-1 underline-offset-2', isCancelled ? 'text-[#52525b]' : 'text-[#e11d48]')}
                              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.05rem' }}
                            >
                              {fight.red_name}
                            </p>
                            {!isCancelled && (
                              <span className="flex items-center gap-1 shrink-0">
                                <ExternalLink className="w-3 h-3 text-[#3f3f46] group-hover/red:text-[#e11d48] transition-colors" />
                                <span className="text-[9px] text-[#3f3f46] group-hover/red:text-[#e11d48] transition-colors">Sherdog</span>
                              </span>
                            )}
                          </a>
                        ) : (
                          <p
                            className={cn('leading-tight uppercase truncate', isCancelled ? 'text-[#52525b]' : 'text-[#e11d48]')}
                            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.05rem' }}
                          >
                            {fight.red_name}
                          </p>
                        )}
                        <p className="text-[9px] text-[#3f3f46] font-bold my-1 tracking-widest uppercase">vs</p>
                        {fight.blue_sherdog_url ? (
                          <a
                            href={fight.blue_sherdog_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn('group/blue flex items-center gap-1.5 w-fit', isCancelled && 'pointer-events-none')}
                          >
                            <p
                              className={cn('leading-tight uppercase truncate group-hover/blue:underline decoration-1 underline-offset-2', isCancelled ? 'text-[#52525b]' : 'text-blue-400')}
                              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.05rem' }}
                            >
                              {fight.blue_name}
                            </p>
                            {!isCancelled && (
                              <span className="flex items-center gap-1 shrink-0">
                                <ExternalLink className="w-3 h-3 text-[#3f3f46] group-hover/blue:text-blue-400 transition-colors" />
                                <span className="text-[9px] text-[#3f3f46] group-hover/blue:text-blue-400 transition-colors">Sherdog</span>
                              </span>
                            )}
                          </a>
                        ) : (
                          <p
                            className={cn('leading-tight uppercase truncate', isCancelled ? 'text-[#52525b]' : 'text-blue-400')}
                            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.05rem' }}
                          >
                            {fight.blue_name}
                          </p>
                        )}
                      </div>

                      {/* Result or status pill */}
                      {isCancelled ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-[#222] shrink-0">
                          <span className="text-[10px] font-bold text-[#52525b] tracking-widest uppercase">Cancelled</span>
                        </div>
                      ) : isFinal ? (
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-bold tracking-widest text-[#3f3f46] uppercase mb-1">Result</p>
                          <p
                            className={cn(
                              'leading-tight uppercase',
                              result === 'red' ? 'text-[#e11d48]'
                                : result === 'blue' ? 'text-blue-400'
                                : 'text-[#71717a]'
                            )}
                            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '1.15rem' }}
                          >
                            {resultName ? getLastName(resultName) : (result === 'draw' ? 'Draw' : 'NC')}
                          </p>
                          <p className="text-[10px] text-[#52525b] mt-0.5">
                            {fight.result_method ? METHOD_LABELS[fight.result_method] : ''}
                            {fight.result_round ? ` · R${fight.result_round}` : ''}
                          </p>
                        </div>
                      ) : fight.status === 'live' ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse" />
                          <span className="text-[10px] font-bold text-[#e11d48] tracking-widest uppercase">Live</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e1e1e] border border-[#27272a] shrink-0">
                          <span className="text-[10px] font-bold text-[#52525b] tracking-widest uppercase">Pending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Player pick rows — hidden for cancelled fights ── */}
                  {!isCancelled && (
                    <div className="bg-[#0a0a0a]">
                      {picksRows.map(({ uid, profile }, pidx) => {
                        const pick = picksIndex[`${uid}:${fight.id}`]
                        const isMe = uid === user.id

                        const correctWinner = isFinal && !!result && pick?.pick_winner === result
                        const pts = pick?.points_earned ?? 0
                        const pickProfileHref = isMe
                          ? '/profile'
                          : profile?.username
                          ? `/profile/${encodeURIComponent(profile.username)}?from=${leagueId}`
                          : '#'
                        const isLast = pidx === picksRows.length - 1

                        return (
                          <div
                            key={uid}
                            className={cn(
                              'px-5 transition-colors',
                              correctWinner ? 'bg-green-500/[0.04]' : '',
                              !isLast && 'border-b border-[#111111]'
                            )}
                          >
                            <div className="flex items-center gap-3.5 py-3">
                              {/* Avatar + Name (clickable) */}
                              <Link
                                href={pickProfileHref}
                                className="flex items-center gap-3 flex-1 min-w-0 group/pick"
                              >
                                <div className={cn(
                                  'w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 border overflow-hidden',
                                  isMe
                                    ? 'bg-[#e11d48]/15 border-[#e11d48]/30 text-[#e11d48]'
                                    : 'bg-[#141414] border-[#1e1e1e] text-[#52525b]'
                                )}>
                                  {profile?.avatar_url
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                    : getInitials(profile?.username ?? 'U')}
                                </div>
                                <span className={cn(
                                  'text-[13px] font-semibold flex-1 min-w-0 truncate transition-colors',
                                  isMe
                                    ? 'text-[#e11d48]/70 group-hover/pick:text-[#e11d48]'
                                    : 'text-[#71717a] group-hover/pick:text-[#a1a1aa]'
                                )}>
                                  {profile?.username ?? '?'}
                                </span>
                              </Link>

                              {/* Pick + Points (right side) */}
                              <div className="flex items-center gap-3 shrink-0">
                                {pick ? (
                                  <div className="flex items-center gap-2 text-right">
                                    <span className={cn(
                                      'text-[13px] font-bold',
                                      pick.pick_winner === 'red' ? 'text-[#e11d48]' : 'text-blue-400',
                                      isFinal && !correctWinner && 'opacity-20'
                                    )}>
                                      {getLastName(pick.pick_winner === 'red' ? fight.red_name : fight.blue_name)}
                                    </span>
                                    <span className={cn(
                                      'text-[11px]',
                                      isFinal
                                        ? correctWinner ? 'text-[#71717a]' : 'text-[#3f3f46]'
                                        : 'text-[#52525b]'
                                    )}>
                                      {METHOD_LABELS[pick.pick_method] ?? pick.pick_method}
                                      {pick.pick_round ? ` R${pick.pick_round}` : ''}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-[#3f3f46]">No pick</span>
                                )}
                                {isFinal && pick && (
                                  <span
                                    className={cn(
                                      'w-9 text-right tabular-nums',
                                      pts > 0 ? 'text-green-400' : 'text-[#3f3f46]'
                                    )}
                                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '0.85rem' }}
                                  >
                                    {pts > 0 ? `+${pts}` : '0'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </div>
  )
}
