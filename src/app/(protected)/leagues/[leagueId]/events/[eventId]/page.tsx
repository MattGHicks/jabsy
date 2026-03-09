import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft, Lock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDateTime, isPicksOpen } from '@/lib/utils'
import { PicksPageClient } from './picks-page-client'
import { LocalTime } from '@/components/local-time'

interface PageProps {
  params: Promise<{ leagueId: string; eventId: string }>
}

export default async function PicksPage({ params }: PageProps) {
  const { leagueId, eventId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify league membership
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

  // Verify this event is in this league
  const { data: leagueEvent } = await supabase
    .from('league_events')
    .select('event_id')
    .eq('league_id', leagueId)
    .eq('event_id', eventId)
    .single()

  if (!leagueEvent) notFound()

  // Get event + fights
  const { data: event } = await supabase
    .from('events')
    .select('*, fights(*, result_winner, result_method, result_round, status, bout_order)')
    .eq('id', eventId)
    .single()

  if (!event) notFound()

  // Block access if picks aren't open yet (before event day in ET)
  if (event.status === 'upcoming' && !isPicksOpen(event.start_time, event.lock_time)) {
    redirect(`/leagues/${leagueId}`)
  }

  // Auto-transition upcoming → live when lock_time (= picks lock / event start) has passed
  const lockTrigger = event.lock_time ?? event.start_time
  if (event.status === 'upcoming' && new Date() >= new Date(lockTrigger)) {
    const adminClient = createAdminClient()
    await adminClient.from('events').update({ status: 'live' }).eq('id', eventId)
    event.status = 'live'
  }

  const isEventOver = event.status === 'live' || event.status === 'completed'
  if (isEventOver) redirect(`/leagues/${leagueId}/events/${eventId}/board`)

  const isLocked = isEventOver
    || (event.lock_time != null && new Date() >= new Date(event.lock_time))

  // Sort fights by bout order ascending (main event first, bout_order 1 = main event)
  const fights = [...(event.fights ?? [])].sort((a, b) => a.bout_order - b.bout_order)
  const activeFights = fights.filter((f) => f.status !== 'cancelled')

  // Get user's existing picks for this event
  const { data: userPicks } = await supabase
    .from('picks')
    .select('fight_id, pick_winner, pick_method, pick_round')
    .eq('user_id', user.id)
    .eq('league_id', leagueId)
    .eq('event_id', eventId)

  const picksMap: Record<string, { pick_winner: string; pick_method: string; pick_round: number | null }> = {}
  for (const p of userPicks ?? []) {
    picksMap[p.fight_id] = { pick_winner: p.pick_winner, pick_method: p.pick_method, pick_round: p.pick_round }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back */}
      <Link
        href={`/leagues/${leagueId}`}
        className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70"
      >
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#52525b] uppercase mb-1">Back to</span>
          <span
            className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}
          >
            {league.name}
          </span>
        </div>
      </Link>

      {/* Header */}
      <div className="mb-10">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-1.5">
          {formatDateTime(event.start_time)}{event.venue ? ` · ${event.venue}` : ''}
        </p>
        <h1
          className="leading-[0.9] text-[#f4f4f5] uppercase"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2.2rem, 5vw, 3rem)' }}
        >
          {event.name}
        </h1>
      </div>

      {/* Lock notice */}
      {isLocked && event.status === 'upcoming' && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-400">
          <Lock className="w-4 h-4 shrink-0" />
          Picks are locked — the event has started.
        </div>
      )}
      {!isLocked && event.lock_time && (
        <div className="mb-6 flex items-start gap-2 px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#27272a] text-sm text-[#71717a]">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Picks lock at <LocalTime isoString={event.lock_time} /> (early prelims)</span>
        </div>
      )}

      {/* Cancelled notice */}
      {event.status === 'cancelled' && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-800/50 border border-zinc-700 text-sm text-zinc-400">
          <Lock className="w-4 h-4 shrink-0" />
          This event has been cancelled.
        </div>
      )}

      {/* Fight cards + sticky picks bar (client component) */}
      <PicksPageClient
        fights={fights}
        leagueId={leagueId}
        eventId={eventId}
        picksMap={picksMap}
        isLocked={isLocked}
        activeFightsCount={activeFights.length}
      />
    </div>
  )
}
