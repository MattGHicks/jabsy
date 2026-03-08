'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, BarChart2, Lock, Trophy, Users, Crown, ExternalLink } from 'lucide-react'
import { cn, formatDateTime, getInitials } from '@/lib/utils'
import { LockCountdown } from '@/components/admin/lock-countdown'
import { isPicksOpen } from '@/lib/utils'
import { RemoveMemberButton } from './remove-member-button'

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  upcoming: { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Upcoming' },
  live: { badge: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20', label: 'Live' },
  completed: { badge: 'bg-zinc-800 text-zinc-400 border-zinc-700', label: 'Completed' },
  cancelled: { badge: 'bg-zinc-900 text-zinc-600 border-zinc-800', label: 'Cancelled' },
}

interface Event {
  id: string
  name: string
  start_time: string
  lock_time: string | null
  status: string
  venue: string | null
  fights: { id: string; status: string }[]
}

type WinnerInfo = { username: string | null; avatar_url: string | null; points: number }
type ProfileInfo = { username: string | null; avatar_url: string | null }
type MemberInfo = { id: string; username: string | null; avatar_url: string | null }

interface LeagueTabsProps {
  leagueId: string
  events: Event[]
  isOwner: boolean
  pickCounts: Record<string, number>
  eventWinners: Record<string, WinnerInfo[]>
  standings: { userId: string; totalPoints: number }[]
  profilesMap: Record<string, ProfileInfo>
  currentUserId: string
  // Members tab props
  members: MemberInfo[]
  ownerProfile: MemberInfo | null
  leagueOwnerId: string
  standingsTotals: Record<string, number>
}

const RANK_STYLES = [
  { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  { color: 'text-zinc-300', bg: 'bg-zinc-700/30 border-zinc-600/30' },
  { color: 'text-amber-600', bg: 'bg-amber-700/10 border-amber-700/20' },
]

type TabKey = 'events' | 'completed' | 'standings' | 'members'

export function LeagueTabs({ leagueId, events, isOwner, pickCounts, eventWinners, standings, profilesMap, currentUserId, members, ownerProfile, leagueOwnerId, standingsTotals }: LeagueTabsProps) {
  const [tab, setTab] = useState<TabKey>('events')

  const activeEvents = events.filter(e => e.status !== 'completed' && e.status !== 'cancelled')
  const completedEvents = events.filter(e => e.status === 'completed')
  const memberCount = (ownerProfile ? 1 : 0) + members.filter(m => m.id !== ownerProfile?.id).length

  const tabs: { key: TabKey; label: string; icon: typeof Calendar; count: number }[] = [
    { key: 'events', label: 'Events', icon: Calendar, count: activeEvents.length },
    { key: 'completed', label: 'Completed', icon: Trophy, count: completedEvents.length },
    { key: 'standings', label: 'Standings', icon: BarChart2, count: standings.length },
    { key: 'members', label: 'Members', icon: Users, count: memberCount },
  ]

  return (
    <div>
      {/* Tabs — 2x2 grid on mobile, single row on desktop */}
      <div className="mb-6">
        <div className="grid grid-cols-2 sm:flex gap-2">
          {tabs.map(({ key, label, icon: Icon, count }) => {
            const isActive = tab === key
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'inline-flex items-center justify-center sm:justify-start gap-2 h-9 px-4 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap border',
                  isActive
                    ? 'bg-[#e11d48] text-white border-[#e11d48] shadow-sm'
                    : 'bg-[#111111] text-[#71717a] border-[#1e1e1e] hover:text-[#a1a1aa] hover:border-[#27272a]'
                )}
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="uppercase tracking-wide">{label}</span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-md font-bold',
                  isActive ? 'bg-white/20 text-white' : 'bg-[#1a1a1a] text-[#52525b]'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Events tab (upcoming + live only) */}
      {tab === 'events' && (
        <div>
          {activeEvents.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Calendar className="w-8 h-8 text-[#52525b] mb-3" />
              <p className="text-sm text-[#71717a] mb-2">No upcoming events in this league.</p>
              {isOwner && (
                <Link
                  href={`/leagues/${leagueId}/settings`}
                  className="text-sm text-[#e11d48] hover:underline"
                >
                  Go to Settings to add events →
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeEvents.map((event) => renderEventCard(event, leagueId, pickCounts, eventWinners))}
            </div>
          )}
        </div>
      )}

      {/* Completed tab */}
      {tab === 'completed' && (
        <div>
          {completedEvents.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Trophy className="w-8 h-8 text-[#52525b] mb-3" />
              <p className="text-sm text-[#71717a]">No completed events yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {completedEvents.map((event) => renderEventCard(event, leagueId, pickCounts, eventWinners))}
            </div>
          )}
        </div>
      )}

      {/* Standings tab */}
      {tab === 'standings' && (
        <div className="flex flex-col gap-2">
          {standings.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <BarChart2 className="w-8 h-8 text-[#52525b] mb-3" />
              <p className="text-sm text-[#71717a]">No standings yet. Make picks to get on the board.</p>
            </div>
          ) : (
            standings.map((s, i) => {
              const profile = profilesMap[s.userId]
              const isMe = s.userId === currentUserId
              const rankStyle = RANK_STYLES[i] ?? null
              const rank = i + 1

              return (
                <div
                  key={s.userId}
                  className={cn(
                    'flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors',
                    isMe
                      ? 'bg-[#e11d48]/5 border-[#e11d48]/25'
                      : 'bg-[#141414] border-[#1e1e1e]'
                  )}
                >
                  {/* Rank */}
                  <div className={cn(
                    'w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-sm font-bold border',
                    rankStyle ? rankStyle.bg : 'bg-[#1e1e1e] border-[#27272a]',
                    rankStyle ? rankStyle.color : 'text-[#52525b]'
                  )}>
                    {rank}
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0">
                    {profile?.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold text-[#71717a] flex items-center justify-center w-full h-full">{getInitials(profile?.username ?? 'U')}</span>
                    }
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-semibold truncate', isMe ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]')}>
                      {profile?.username ?? 'Unknown'}
                      {isMe && <span className="ml-2 text-xs text-[#e11d48] font-normal">you</span>}
                    </p>
                  </div>

                  {/* Points */}
                  <div className="text-right shrink-0">
                    <p
                      className={cn('text-lg font-bold leading-none', rankStyle ? rankStyle.color : 'text-[#f4f4f5]')}
                      style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
                    >
                      {s.totalPoints}
                    </p>
                    <p className="text-[10px] text-[#52525b] mt-0.5 uppercase tracking-wide">pts</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="flex flex-col gap-2">
          {/* Owner always first */}
          {ownerProfile && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#141414] border border-[#e11d48]/15">
              <div className="w-8 h-8 rounded-full bg-[#e11d48]/15 border border-[#e11d48]/25 flex items-center justify-center overflow-hidden shrink-0">
                {ownerProfile.avatar_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={ownerProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-xs font-bold text-[#e11d48]">{getInitials(ownerProfile.username ?? 'O')}</span>
                }
              </div>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <p className="text-sm font-semibold text-[#f4f4f5] truncate">{ownerProfile.username}</p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20 shrink-0">
                  <Crown className="w-2.5 h-2.5" /> Owner
                </span>
                {ownerProfile.id === currentUserId && (
                  <span className="text-[10px] text-[#52525b]">you</span>
                )}
              </div>
              {(standingsTotals[leagueOwnerId] ?? 0) > 0 && (
                <span
                  className="text-sm font-bold text-[#e11d48] shrink-0"
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                >
                  {standingsTotals[leagueOwnerId]} <span className="text-[10px] font-normal text-[#52525b]">pts</span>
                </span>
              )}
              <Link
                href={ownerProfile.id === currentUserId ? '/profile' : `/profile/${ownerProfile.username ?? ''}`}
                className="inline-flex items-center gap-1.5 text-[#71717a] hover:text-[#a1a1aa] transition-colors shrink-0 text-xs"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">View profile</span>
              </Link>
            </div>
          )}

          {/* Other members */}
          {members
            .filter(m => m.id !== ownerProfile?.id)
            .map((p) => {
              const isMe = p.id === currentUserId
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg border',
                    isMe ? 'bg-[#e11d48]/5 border-[#e11d48]/15' : 'bg-[#141414] border-[#1e1e1e]'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-[#1e1e1e] border border-[#27272a] flex items-center justify-center overflow-hidden shrink-0">
                    {p.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-bold text-[#71717a]">{getInitials(p.username ?? 'M')}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <p className="text-sm font-semibold text-[#a1a1aa] truncate">{p.username}</p>
                    {isMe && <span className="text-[10px] text-[#52525b]">you</span>}
                  </div>
                  {(standingsTotals[p.id] ?? 0) > 0 && (
                    <span
                      className="text-sm font-bold text-[#a1a1aa] shrink-0"
                      style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                    >
                      {standingsTotals[p.id]} <span className="text-[10px] font-normal text-[#52525b]">pts</span>
                    </span>
                  )}
                  <Link
                    href={isMe ? '/profile' : `/profile/${p.username ?? ''}?from=${leagueId}`}
                    className="inline-flex items-center gap-1.5 text-[#71717a] hover:text-[#a1a1aa] transition-colors shrink-0 text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">View profile</span>
                  </Link>
                  {isOwner && !isMe && (
                    <RemoveMemberButton
                      leagueId={leagueId}
                      memberId={p.id}
                      username={p.username}
                    />
                  )}
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

/** Shared event card renderer for Events + Completed tabs */
function renderEventCard(
  event: Event,
  leagueId: string,
  pickCounts: Record<string, number>,
  eventWinners: Record<string, WinnerInfo[]>
) {
  const style = STATUS_STYLES[event.status] ?? STATUS_STYLES.upcoming
  const isLocked = event.status === 'live' || event.status === 'completed'
  const picksOpen = event.status === 'upcoming' && isPicksOpen(event.start_time, event.lock_time)
  const activeFights = (event.fights ?? []).filter((f) => f.status !== 'cancelled')
  const fightCount = event.fights?.length ?? 0
  const picked = pickCounts[event.id] ?? 0
  const allPicked = activeFights.length > 0 && picked >= activeFights.length
  const somePicked = picked > 0 && !allPicked

  let btnLabel: string
  let btnClass: string
  if (isLocked) {
    btnLabel = 'View Board'
    btnClass = 'bg-[#1e1e1e] border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333]'
  } else if (!picksOpen && event.status === 'upcoming') {
    btnLabel = 'Not Yet Open'
    btnClass = 'bg-[#1e1e1e] border-[#1e1e1e] text-[#3f3f46] cursor-not-allowed'
  } else if (allPicked) {
    btnLabel = 'Edit Picks'
    btnClass = 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
  } else if (somePicked) {
    btnLabel = 'Complete Your Picks'
    btnClass = 'bg-[#e11d48]/10 border-[#e11d48]/30 text-[#e11d48] hover:bg-[#e11d48]/20'
  } else {
    btnLabel = 'Make Picks'
    btnClass = 'bg-[#1e1e1e] border-[#27272a] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333]'
  }

  const winners = eventWinners[event.id] ?? []

  return (
    <div
      key={event.id}
      className="flex flex-col gap-4 p-5 rounded-xl bg-[#141414] border border-[#1e1e1e] hover:border-[#27272a] transition-colors"
    >
      {/* Top row: status + action buttons */}
      <div className="flex items-center justify-between gap-3">
        <div className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0', style.badge)}>
          {event.status === 'live' && (
            <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse inline-block" />
          )}
          {style.label}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Always show View Board link for upcoming events (so players can see fight card) */}
          {!isLocked && (
            <Link
              href={`/leagues/${leagueId}/events/${event.id}/board`}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs border border-[#27272a] bg-[#1e1e1e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333] transition-colors uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
            >
              View Board
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
          {(!picksOpen && event.status === 'upcoming') ? (
            <span
              className={cn('inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs border uppercase tracking-wide', btnClass)}
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
            >
              <Lock className="w-3 h-3" />
              {btnLabel}
            </span>
          ) : (
            <Link
              href={isLocked
                ? `/leagues/${leagueId}/events/${event.id}/board`
                : `/leagues/${leagueId}/events/${event.id}`
              }
              className={cn('inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-xs border transition-colors uppercase tracking-wide', btnClass)}
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
            >
              {btnLabel}
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Event name */}
      <div>
        <p
          className="text-xl text-[#f4f4f5] uppercase leading-tight truncate"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
        >
          {event.name}
        </p>
      </div>

      {/* Bottom row: meta + winner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-[#1e1e1e]">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-[#71717a]">
            {formatDateTime(event.start_time)}
            <span className="mx-1.5 text-[#333]">·</span>
            {fightCount} {fightCount === 1 ? 'fight' : 'fights'}
            {event.venue && (
              <>
                <span className="mx-1.5 text-[#333]">·</span>
                {event.venue}
              </>
            )}
          </p>
          {event.status === 'upcoming' && (
            <p className="text-xs">
              {picksOpen ? (
                <LockCountdown lockTime={event.lock_time} />
              ) : (
                <span className="text-[#52525b]">
                  Picks open day of event
                </span>
              )}
            </p>
          )}
        </div>

        {/* Winner(s) */}
        {winners.length > 0 && (
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-yellow-500/70 shrink-0" />
            <div className="flex items-center gap-1.5">
              {winners.map((w, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-[#27272a] border border-[#3f3f46] overflow-hidden shrink-0">
                    {w.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={w.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[8px] font-bold text-[#71717a] flex items-center justify-center w-full h-full">{getInitials(w.username ?? 'U')}</span>
                    }
                  </div>
                  <span className="text-xs font-semibold text-yellow-500/80">
                    {w.username ?? 'Unknown'}
                    {i < winners.length - 1 ? ' &' : ''}
                  </span>
                </div>
              ))}
              <span className="text-xs text-[#52525b]">· {winners[0].points} pts</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
