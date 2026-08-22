'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Calendar, ChevronRight, BarChart2, Lock, Trophy, Crown, Info, X, TrendingUp, Zap, Target, Award, Crosshair, Activity } from 'lucide-react'
import { cn, formatDateTime, getInitials, formatDate } from '@/lib/utils'
import { LockCountdown } from '@/components/admin/lock-countdown'
import { isPicksOpen } from '@/lib/utils'
import { RemoveMemberButton } from './remove-member-button'
import { ActivityTab } from './activity-tab'
import { ShareButton } from '@/components/share-button'

const STATUS_STYLES: Record<string, { badge: string; label: string }> = {
  upcoming: { badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Upcoming' },
  live: { badge: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20', label: 'Live' },
  completed: { badge: 'bg-zinc-800 text-zinc-400 border-zinc-700', label: 'Completed' },
  cancelled: { badge: 'bg-zinc-900 text-zinc-600 border-zinc-800', label: 'Cancelled' },
}

function getUpcomingLabel(startTime: string): { label: string; badge: string; isToday: boolean } {
  const now = new Date()
  const eventDate = new Date(startTime)
  const et = (d: Date) => new Date(d.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const nowET = et(now)
  const eventET = et(eventDate)
  const todayET = new Date(nowET.getFullYear(), nowET.getMonth(), nowET.getDate())
  const eventDayET = new Date(eventET.getFullYear(), eventET.getMonth(), eventET.getDate())
  const diffDays = Math.round((eventDayET.getTime() - todayET.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) {
    return { label: 'Today', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]', isToday: true }
  } else if (diffDays === 1) {
    return { label: 'Tomorrow', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', isToday: false }
  } else {
    return { label: `${diffDays} days`, badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20', isToday: false }
  }
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

export interface LeagueStats {
  mostEventWins: { username: string | null; avatar_url: string | null; count: number } | null
  highestAccuracy: { username: string | null; avatar_url: string | null; value: number } | null
  mostPoints: { username: string | null; avatar_url: string | null; value: number } | null
  bestEventScore: { username: string | null; avatar_url: string | null; value: number; eventName: string } | null
  tightestFinish: { eventName: string; margin: number } | null
  mostPerfectPicks: { users: { username: string | null; avatar_url: string | null }[]; count: number } | null
}

interface LeagueTabsProps {
  leagueId: string
  leagueName: string
  shareCode: string
  events: Event[]
  isOwner: boolean
  pickCounts: Record<string, number>
  eventWinners: Record<string, WinnerInfo[]>
  standings: { userId: string; totalPoints: number; accuracy: number | null }[]
  profilesMap: Record<string, ProfileInfo>
  currentUserId: string
  members: MemberInfo[]
  ownerProfile: MemberInfo | null
  leagueOwnerId: string
  standingsTotals: Record<string, number>
  leagueStats: LeagueStats
  currentUserProfile: { username: string | null; avatar_url: string | null }
  initialTab?: TabKey
  /** Map of memberId → number of fights they've picked across all upcoming/live events (used as a per-event "submitted" indicator near the standings rows). Optional. */
  joinedAt?: Record<string, string>
}

const RANK_STYLES = [
  { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  { color: 'text-zinc-300', bg: 'bg-zinc-700/30 border-zinc-600/30' },
  { color: 'text-amber-600', bg: 'bg-amber-700/10 border-amber-700/20' },
]

type TabKey = 'events' | 'completed' | 'standings' | 'stats' | 'activity'

export function LeagueTabs({ leagueId, leagueName, shareCode, events, isOwner, pickCounts, eventWinners, standings, profilesMap, currentUserId, members, ownerProfile, leagueOwnerId, standingsTotals, leagueStats, currentUserProfile, initialTab, joinedAt }: LeagueTabsProps) {
  const [tab, setTab] = useState<TabKey>(initialTab ?? 'events')
  const [showAccuracyInfo, setShowAccuracyInfo] = useState(false)
  const tabBarRef = useRef<HTMLDivElement>(null)

  function handleTabChange(key: TabKey) {
    setTab(key)
    requestAnimationFrame(() => {
      tabBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const activeEvents = events.filter(e => e.status !== 'completed' && e.status !== 'cancelled')
  const completedEvents = events.filter(e => e.status === 'completed')
  const memberCount = (ownerProfile ? 1 : 0) + members.filter(m => m.id !== ownerProfile?.id).length

  const tabs: { key: TabKey; label: string; icon: typeof Calendar; count: number | string; accent: string; accentBg: string; accentBorder: string; badge?: number }[] = [
    { key: 'events', label: 'Events', icon: Calendar, count: activeEvents.length, accent: '#60a5fa', accentBg: 'rgba(96,165,250,0.08)', accentBorder: 'rgba(96,165,250,0.15)' },
    { key: 'completed', label: 'Completed', icon: Trophy, count: completedEvents.length, accent: '#fbbf24', accentBg: 'rgba(251,191,36,0.08)', accentBorder: 'rgba(251,191,36,0.15)' },
    { key: 'standings', label: 'Standings', icon: BarChart2, count: memberCount, accent: '#e11d48', accentBg: 'rgba(225,29,72,0.08)', accentBorder: 'rgba(225,29,72,0.15)' },
    { key: 'stats', label: 'League Stats', icon: Zap, count: 'VIEW', accent: '#a78bfa', accentBg: 'rgba(167,139,250,0.08)', accentBorder: 'rgba(167,139,250,0.15)' },
    { key: 'activity', label: 'Activity', icon: Activity, count: 'FEED', accent: '#f97316', accentBg: 'rgba(249,115,22,0.08)', accentBorder: 'rgba(249,115,22,0.15)' },
  ]

  return (
    <div>
      {/* Tab cards — matching dashboard stat-card style */}
      <div ref={tabBarRef} className="grid grid-cols-6 sm:grid-cols-5 gap-2.5 mb-8 scroll-mt-16">
        {tabs.map(({ key, label, icon: Icon, count, accent, accentBg, accentBorder, badge }, i) => {
          const isActive = tab === key
          // Mobile balances 5 tabs across two rows: first 3 take 2 cols each (row 1 fills), last 2 take 3 cols each (row 2 fills).
          // Desktop is always a single row of equal columns.
          const mobileSpan = tabs.length === 5
            ? (i < 3 ? 'col-span-2' : 'col-span-3')
            : 'col-span-2'
          return (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={cn(
                'relative flex flex-col items-center gap-2 py-4 sm:py-5 px-3 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden active:scale-[0.97]',
                mobileSpan,
                'sm:col-span-1',
                isActive
                  ? 'bg-[#141414] border-[#27272a] shadow-[0_0_12px_rgba(0,0,0,0.3)]'
                  : 'bg-[#111111] border-[#1e1e1e] hover:bg-[#141414] hover:border-[#27272a] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)]'
              )}
            >
              {/* Active indicator bar — full width */}
              <div
                className={cn(
                  'absolute bottom-0 left-0 right-0 h-[3px] transition-all duration-200',
                  isActive ? 'opacity-100' : 'opacity-0'
                )}
                style={{ backgroundColor: accent }}
              />
              <div className="relative">
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-opacity duration-200"
                  style={{
                    background: isActive ? accentBg : 'rgba(113,113,122,0.06)',
                    border: `1px solid ${isActive ? accentBorder : 'rgba(113,113,122,0.1)'}`,
                  }}
                >
                  <Icon
                    className="w-4 h-4 sm:w-[18px] sm:h-[18px] transition-colors duration-200"
                    style={{ color: isActive ? accent : '#52525b' }}
                  />
                </div>
                {badge !== undefined && badge > 0 && !isActive && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[#e11d48] text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-lg shadow-[#e11d48]/30">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    'leading-none mb-1 transition-colors duration-200',
                    typeof count === 'string' && count.length > 2 ? 'text-sm sm:text-base' : 'text-xl sm:text-2xl',
                    isActive ? 'text-[#f4f4f5]' : 'text-[#71717a]'
                  )}
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                >
                  {count}
                </p>
                <p className={cn(
                  'text-[9px] sm:text-[10px] uppercase tracking-wider transition-colors duration-200',
                  isActive ? 'text-[#52525b]' : 'text-[#3f3f46]'
                )}>
                  {label}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Tab content — keyed wrapper for fade-in on switch */}
      <div key={tab} className="animate-fade-in" style={{ animationDuration: '0.25s' }}>

      {/* Events tab (upcoming + live only) */}
      {tab === 'events' && (
        <div>
          {activeEvents.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
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
            <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
              {activeEvents.map((event) => renderEventCard(event, leagueId, leagueName, shareCode, pickCounts, eventWinners))}
            </div>
          )}
        </div>
      )}

      {/* Completed tab */}
      {tab === 'completed' && (
        <div>
          {completedEvents.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <Trophy className="w-8 h-8 text-[#52525b] mb-3" />
              <p className="text-sm text-[#71717a]">No completed events yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 md:grid md:grid-cols-2">
              {completedEvents.map((event) => renderEventCard(event, leagueId, leagueName, shareCode, pickCounts, eventWinners))}
            </div>
          )}
        </div>
      )}

      {/* Standings tab — merged with Members functionality */}
      {tab === 'standings' && (
        <div className="flex flex-col gap-2.5">
          {/* Accuracy info toggle */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setShowAccuracyInfo(!showAccuracyInfo)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wider transition-all cursor-pointer',
                showAccuracyInfo
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'text-[#52525b] hover:text-[#71717a] border border-transparent hover:border-[#1e1e1e]'
              )}
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
            >
              {showAccuracyInfo ? <X className="w-3 h-3" /> : <Info className="w-3 h-3" />}
              How accuracy works
            </button>
          </div>

          {/* Accuracy explainer card */}
          {showAccuracyInfo && (
            <div className="p-5 rounded-xl bg-blue-500/[0.04] border border-blue-500/15 mb-1">
              <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-[0.15em] mb-3">Weighted Accuracy</p>
              <p className="text-[13px] text-[#a1a1aa] leading-relaxed mb-4">
                Your accuracy reflects how well you predict fight outcomes — not just the winner, but the method and round too. It&apos;s calculated as <span className="text-[#f4f4f5] font-semibold">points earned ÷ max possible points</span>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#1e1e1e]">
                  <span className="text-lg font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>5</span>
                  <span className="text-[11px] text-[#71717a]">pts for correct <span className="text-[#a1a1aa]">winner</span></span>
                </div>
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#1e1e1e]">
                  <span className="text-lg font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>+3</span>
                  <span className="text-[11px] text-[#71717a]">pts for correct <span className="text-[#a1a1aa]">method</span></span>
                </div>
                <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-[#0a0a0a] border border-[#1e1e1e]">
                  <span className="text-lg font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>+2</span>
                  <span className="text-[11px] text-[#71717a]">pts for correct <span className="text-[#a1a1aa]">round</span></span>
                </div>
              </div>
              <p className="text-[11px] text-[#52525b] mt-3 leading-relaxed">
                Max per fight: <span className="text-[#71717a]">10 pts</span> (KO/Sub) or <span className="text-[#71717a]">8 pts</span> (Decision). Draws &amp; No Contests are excluded. Missing an event won&apos;t hurt your accuracy.
              </p>
            </div>
          )}

          {standings.length === 0 ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-center py-8 text-center rounded-xl border border-dashed border-[#1e1e1e]">
                <BarChart2 className="w-7 h-7 text-[#52525b] mb-2.5" />
                <p className="text-sm text-[#71717a]">No standings yet</p>
                <p className="text-xs text-[#52525b] mt-0.5">Make picks to get on the board</p>
              </div>
              {(() => {
                const seen = new Set<string>()
                const all = [
                  ...(ownerProfile ? [ownerProfile] : []),
                  ...members.filter((m) => m.id !== ownerProfile?.id),
                ].filter((m) => {
                  if (seen.has(m.id)) return false
                  seen.add(m.id)
                  return true
                })
                if (all.length === 0) return null
                return (
                  <div>
                    <p className="text-[10px] font-semibold text-[#52525b] uppercase tracking-[0.15em] mb-2 mt-2">
                      Members · {all.length}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {all.map((m) => {
                        const isMe = m.id === currentUserId
                        const isLeagueOwner = m.id === leagueOwnerId
                        const profileUrl = isMe ? '/profile' : `/profile/${m.username ?? ''}?from=${leagueId}`
                        return (
                          <Link
                            key={m.id}
                            href={profileUrl}
                            className={cn(
                              'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 group',
                              isMe
                                ? 'bg-[#e11d48]/5 border-[#e11d48]/25 hover:bg-[#e11d48]/8'
                                : 'bg-[#111111] border-[#1e1e1e] hover:border-[#27272a] hover:bg-[#141414]'
                            )}
                          >
                            <div className="w-9 h-9 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0">
                              {m.avatar_url
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={m.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                : <span className="text-xs font-bold text-[#71717a] flex items-center justify-center w-full h-full">{getInitials(m.username ?? 'U')}</span>
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={cn('text-sm font-semibold truncate', isMe ? 'text-[#f4f4f5]' : 'text-[#a1a1aa]')}>
                                  {m.username ?? 'Unknown'}
                                </p>
                                {isMe && <span className="text-xs text-[#e11d48] shrink-0">you</span>}
                                {isLeagueOwner && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20 shrink-0">
                                    <Crown className="w-2.5 h-2.5" />
                                  </span>
                                )}
                              </div>
                              {joinedAt?.[m.id] && (
                                <p className="text-[10px] text-[#3f3f46] group-hover:text-[#52525b] transition-colors mt-0.5">
                                  Joined {formatDate(joinedAt[m.id])}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#27272a] group-hover:text-[#52525b] transition-colors shrink-0" />
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {standings.map((s, i) => {
                const profile = profilesMap[s.userId]
                const isMe = s.userId === currentUserId
                const isLeagueOwner = s.userId === leagueOwnerId
                const rank = i + 1
                const rankStyle = RANK_STYLES[i] ?? null
                const profileUrl = isMe ? '/profile' : `/profile/${profile?.username ?? ''}?from=${leagueId}`

                return (
                  <Link
                    key={s.userId}
                    href={profileUrl}
                    className={cn(
                      'flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 rounded-xl border transition-all duration-200 group',
                      isMe
                        ? 'bg-[#e11d48]/5 border-[#e11d48]/25 hover:bg-[#e11d48]/8'
                        : 'bg-[#111111] border-[#1e1e1e] hover:border-[#27272a] hover:bg-[#141414]'
                    )}
                  >
                    {/* Rank — colored for top 3 */}
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold border tabular-nums',
                      rankStyle ? rankStyle.bg : 'bg-[#0a0a0a] border-[#1e1e1e]',
                      rankStyle ? rankStyle.color : 'text-[#52525b]'
                    )}>
                      {rank}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0 group-hover:border-[#3f3f46] transition-colors">
                      {profile?.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        : <span className="text-sm font-bold text-[#71717a] flex items-center justify-center w-full h-full">{getInitials(profile?.username ?? 'U')}</span>
                      }
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <p className={cn('text-sm font-semibold truncate group-hover:text-[#f4f4f5] transition-colors', isMe ? 'text-[#f4f4f5]' : 'text-[#f4f4f5]')}>
                          {profile?.username ?? 'Unknown'}
                        </p>
                        {isMe && <span className="text-[11px] text-[#e11d48] shrink-0">you</span>}
                        {isLeagueOwner && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20 shrink-0">
                            <Crown className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      {joinedAt?.[s.userId] && (
                        <p className="text-[10px] text-[#3f3f46] group-hover:text-[#52525b] transition-colors mt-0.5">
                          Joined {formatDate(joinedAt[s.userId])}
                        </p>
                      )}
                    </div>

                    {/* Remove button (owner only) */}
                    {isOwner && !isMe && !isLeagueOwner && (
                      <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }} className="shrink-0">
                        <RemoveMemberButton
                          leagueId={leagueId}
                          memberId={s.userId}
                          username={profile?.username ?? null}
                        />
                      </div>
                    )}

                    {/* Accuracy + Points */}
                    <div className="text-right shrink-0">
                      <p
                        className={cn('text-lg sm:text-xl font-bold leading-none tabular-nums', rankStyle ? rankStyle.color : 'text-[#f4f4f5]')}
                        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
                      >
                        {s.accuracy !== null ? `${s.accuracy}%` : '—'}
                      </p>
                      <p className="text-[10px] text-[#52525b] mt-0.5 uppercase tracking-wide tabular-nums">
                        {s.totalPoints > 0 ? `${s.totalPoints} pts` : 'accuracy'}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-[#27272a] group-hover:text-[#52525b] transition-colors shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Activity tab */}
      {tab === 'activity' && (
        <ActivityTab leagueId={leagueId} currentUserId={currentUserId} />
      )}

      {/* League Stats tab */}
      {tab === 'stats' && (
        <div>
          {!leagueStats.mostEventWins && !leagueStats.highestAccuracy && !leagueStats.mostPoints && !leagueStats.bestEventScore && !leagueStats.tightestFinish && !leagueStats.mostPerfectPicks ? (
            <div className="flex flex-col items-center py-20 text-center">
              <TrendingUp className="w-8 h-8 text-[#52525b] mb-3" />
              <p className="text-sm text-[#71717a]">No league stats yet. Complete some events to see stats here.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* ── Hero: Most Event Wins ── */}
              {leagueStats.mostEventWins && (
                <div className="relative rounded-xl bg-[#111111] border border-[#1e1e1e] overflow-hidden">
                  {/* Subtle gold gradient bleed */}
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/[0.04] via-transparent to-transparent pointer-events-none" />
                  <div className="relative flex items-center gap-5 p-6 sm:p-7">
                    {/* Large avatar */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#1e1e1e] border-2 border-yellow-500/20 overflow-hidden shrink-0">
                      {leagueStats.mostEventWins.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={leagueStats.mostEventWins.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        : <span className="text-2xl font-black text-[#52525b] flex items-center justify-center w-full h-full" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>{getInitials(leagueStats.mostEventWins.username ?? 'U')}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <p className="text-[10px] font-semibold text-yellow-500/60 uppercase tracking-[0.15em]">Most Event Wins</p>
                      </div>
                      <p className="text-sm font-semibold text-[#a1a1aa] truncate mb-1">{leagueStats.mostEventWins.username ?? 'Unknown'}</p>
                      <p className="text-4xl sm:text-5xl text-[#f4f4f5] leading-none" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
                        {leagueStats.mostEventWins.count}
                        <span className="text-base sm:text-lg text-[#3f3f46] font-semibold ml-2">{leagueStats.mostEventWins.count === 1 ? 'win' : 'wins'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Row cards ── */}
              <div className="flex flex-col gap-2 md:grid md:grid-cols-2">
                {/* Highest Accuracy */}
                {leagueStats.highestAccuracy && (
                  <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-[#111111] border border-[#1e1e1e]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.15)' }}>
                      <Target className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.12em] mb-0.5">Highest Accuracy</p>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0">
                          {leagueStats.highestAccuracy.avatar_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={leagueStats.highestAccuracy.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            : <span className="text-[7px] font-bold text-[#71717a] flex items-center justify-center w-full h-full">{getInitials(leagueStats.highestAccuracy.username ?? 'U')}</span>
                          }
                        </div>
                        <p className="text-xs text-[#71717a] truncate">{leagueStats.highestAccuracy.username ?? 'Unknown'}</p>
                      </div>
                    </div>
                    <p className="text-2xl sm:text-3xl text-[#f4f4f5] leading-none shrink-0" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                      {leagueStats.highestAccuracy.value}<span className="text-sm text-[#52525b]">%</span>
                    </p>
                  </div>
                )}

                {/* Most Points */}
                {leagueStats.mostPoints && (
                  <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-[#111111] border border-[#1e1e1e]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(225,29,72,0.08)', border: '1px solid rgba(225,29,72,0.15)' }}>
                      <Zap className="w-5 h-5 text-[#e11d48]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.12em] mb-0.5">Most Points</p>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0">
                          {leagueStats.mostPoints.avatar_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={leagueStats.mostPoints.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            : <span className="text-[7px] font-bold text-[#71717a] flex items-center justify-center w-full h-full">{getInitials(leagueStats.mostPoints.username ?? 'U')}</span>
                          }
                        </div>
                        <p className="text-xs text-[#71717a] truncate">{leagueStats.mostPoints.username ?? 'Unknown'}</p>
                      </div>
                    </div>
                    <p className="text-2xl sm:text-3xl text-[#f4f4f5] leading-none shrink-0" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                      {leagueStats.mostPoints.value}<span className="text-sm text-[#52525b] ml-1">pts</span>
                    </p>
                  </div>
                )}

                {/* Best Event Score */}
                {leagueStats.bestEventScore && (
                  <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-[#111111] border border-[#1e1e1e]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}>
                      <Award className="w-5 h-5 text-[#a78bfa]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.12em] mb-0.5">Best Event Score</p>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0">
                          {leagueStats.bestEventScore.avatar_url
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={leagueStats.bestEventScore.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            : <span className="text-[7px] font-bold text-[#71717a] flex items-center justify-center w-full h-full">{getInitials(leagueStats.bestEventScore.username ?? 'U')}</span>
                          }
                        </div>
                        <p className="text-xs text-[#71717a] truncate">{leagueStats.bestEventScore.username ?? 'Unknown'}</p>
                        <span className="text-[10px] text-[#3f3f46]">·</span>
                        <p className="text-[10px] text-[#52525b] truncate">{leagueStats.bestEventScore.eventName}</p>
                      </div>
                    </div>
                    <p className="text-2xl sm:text-3xl text-[#f4f4f5] leading-none shrink-0" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                      {leagueStats.bestEventScore.value}<span className="text-sm text-[#52525b] ml-1">pts</span>
                    </p>
                  </div>
                )}

                {/* Tightest Finish */}
                {leagueStats.tightestFinish && (
                  <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-[#111111] border border-[#1e1e1e]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.12em] mb-0.5">Tightest Finish</p>
                      <p className="text-xs text-[#71717a] truncate">{leagueStats.tightestFinish.eventName}</p>
                    </div>
                    <p className="text-2xl sm:text-3xl text-[#f4f4f5] leading-none shrink-0" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                      {leagueStats.tightestFinish.margin}<span className="text-sm text-[#52525b] ml-1">pt gap</span>
                    </p>
                  </div>
                )}

                {/* Most Perfect Picks */}
                {leagueStats.mostPerfectPicks && (
                  <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-[#111111] border border-[#1e1e1e]">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.15)' }}>
                      <Crosshair className="w-5 h-5 text-[#a78bfa]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.12em] mb-0.5">Most Perfect Picks</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {leagueStats.mostPerfectPicks.users.map((u, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-[10px] text-[#3f3f46]">·</span>}
                            <div className="w-5 h-5 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0">
                              {u.avatar_url
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={u.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                : <span className="text-[7px] font-bold text-[#71717a] flex items-center justify-center w-full h-full">{getInitials(u.username ?? 'U')}</span>
                              }
                            </div>
                            <p className="text-xs text-[#71717a] truncate">{u.username ?? 'Unknown'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-2xl sm:text-3xl text-[#f4f4f5] leading-none shrink-0" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                      {leagueStats.mostPerfectPicks.count}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      </div>{/* end tab content fade wrapper */}
    </div>
  )
}

/** Shared event card renderer for Events + Completed tabs */
function renderEventCard(
  event: Event,
  leagueId: string,
  leagueName: string,
  shareCode: string,
  pickCounts: Record<string, number>,
  eventWinners: Record<string, WinnerInfo[]>
) {
  const upcomingInfo = event.status === 'upcoming' ? getUpcomingLabel(event.start_time) : null
  const style = upcomingInfo
    ? { badge: upcomingInfo.badge, label: upcomingInfo.label }
    : STATUS_STYLES[event.status] ?? STATUS_STYLES.upcoming
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
    btnClass = 'bg-[#0a0a0a] border-[#1e1e1e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#27272a]'
  } else if (!picksOpen && event.status === 'upcoming') {
    btnLabel = 'Not Yet Open'
    btnClass = 'bg-[#0a0a0a] border-[#1e1e1e] text-[#52525b] cursor-not-allowed'
  } else if (allPicked) {
    btnLabel = 'Edit Picks'
    btnClass = 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
  } else if (somePicked) {
    btnLabel = 'Complete Your Picks'
    btnClass = 'bg-[#e11d48]/10 border-[#e11d48]/30 text-[#e11d48] hover:bg-[#e11d48]/20'
  } else {
    btnLabel = 'Make Picks'
    btnClass = 'bg-[#0a0a0a] border-[#1e1e1e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#27272a]'
  }

  const winners = eventWinners[event.id] ?? []

  return (
    <div
      key={event.id}
      className="flex flex-col rounded-xl bg-[#111111] border border-[#1e1e1e] hover:border-[#27272a] transition-colors overflow-hidden"
    >
      {/* Card body */}
      <div className="p-5 sm:p-6 flex flex-col gap-5">
        {/* Status badge */}
        <div className="flex items-center justify-between gap-3">
          <div className={cn('inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0', style.badge)}>
            {event.status === 'live' && (
              <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse inline-block" />
            )}
            {upcomingInfo?.isToday && (
              <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
            )}
            {style.label}
          </div>
          <p className="text-xs text-[#52525b]">
            {fightCount} {fightCount === 1 ? 'fight' : 'fights'}
          </p>
        </div>

        {/* Event name */}
        <div>
          <p
            className="text-xl sm:text-2xl text-[#f4f4f5] uppercase leading-tight"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
          >
            {event.name}
          </p>
          <p className="text-xs text-[#52525b] mt-1.5">
            {formatDateTime(event.start_time)}
            {event.venue && (
              <>
                <span className="mx-1.5 text-[#3f3f46]">·</span>
                {event.venue}
              </>
            )}
          </p>
        </div>

        {/* Lock time / countdown */}
        {event.status === 'upcoming' && (
          <div className="text-xs">
            {picksOpen ? (
              <LockCountdown lockTime={event.lock_time} />
            ) : (
              <span className="text-[#52525b]">
                Picks open day of event
              </span>
            )}
          </div>
        )}

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
                      ? <img src={w.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
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

      {/* Action buttons — footer */}
      <div className="flex items-center gap-2 px-5 sm:px-6 py-3.5 border-t border-[#1e1e1e]/60 bg-[#0e0e0e]">
        {/* Always show View Board link for upcoming events */}
        {!isLocked && (
          <Link
            href={`/leagues/${leagueId}/events/${event.id}/board`}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs border border-[#1e1e1e] bg-[#0a0a0a] text-[#71717a] hover:text-[#a1a1aa] hover:border-[#27272a] transition-colors uppercase tracking-wide"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
          >
            View Board
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
        {(!picksOpen && event.status === 'upcoming') ? (
          <span
            className={cn('inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs border uppercase tracking-wide', btnClass)}
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
            className={cn('inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-xs border transition-colors uppercase tracking-wide', btnClass)}
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
          >
            {btnLabel}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
        <span className="ml-auto" />
        {!isLocked && (
          <ShareButton
            code={shareCode}
            eventId={event.id}
            shareTitle={`${leagueName} · ${event.name}`}
            shareText={`Join ${leagueName} on Jabsy and pick ${event.name}.`}
            variant="inline"
            label="Share"
          />
        )}
      </div>
    </div>
  )
}
