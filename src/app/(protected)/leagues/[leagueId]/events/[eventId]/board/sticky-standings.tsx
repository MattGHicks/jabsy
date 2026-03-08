'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn, getInitials } from '@/lib/utils'
import { Crown } from 'lucide-react'

interface StandingEntry {
  uid: string
  totalPts: number
  profile: { username: string | null; avatar_url: string | null } | undefined
}

interface StickyStandingsProps {
  leaderboard: StandingEntry[]
  currentUserId: string
  maxPts: number
  isLive: boolean
  isCompleted: boolean
}

export function StickyStandings({ leaderboard, currentUserId, maxPts, isLive, isCompleted }: StickyStandingsProps) {
  const [isSticky, setIsSticky] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsSticky(window.scrollY > 50)
    window.addEventListener('scroll', check, { passive: true })
    check()
    return () => window.removeEventListener('scroll', check)
  }, [])

  return (
    <>
      {/* Full standings */}
      <div className="flex flex-col gap-1.5">
        {leaderboard.map(({ uid, profile, totalPts }, idx) => {
          const isMe = uid === currentUserId
          const rank = idx + 1
          const barPct = maxPts > 0 ? Math.round((totalPts / maxPts) * 100) : 0

          return (
            <div
              key={uid}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl border',
                isMe
                  ? 'bg-[#e11d48]/5 border-[#e11d48]/20'
                  : 'bg-[#111111] border-[#1e1e1e]'
              )}
            >
              {/* Rank */}
              <div className="w-5 flex justify-center shrink-0">
                {rank === 1 ? <Crown className="w-4 h-4 text-yellow-400" /> :
                 rank === 2 ? <span className="text-[11px] font-bold text-zinc-400">2</span> :
                 rank === 3 ? <span className="text-[11px] font-bold text-amber-700">3</span> :
                 <span className="text-[11px] text-[#52525b] font-bold">{rank}</span>}
              </div>

              {/* Avatar */}
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0 border',
                isMe
                  ? 'bg-[#e11d48]/20 border-[#e11d48]/40 text-[#e11d48]'
                  : 'bg-[#1e1e1e] border-[#27272a] text-[#71717a]'
              )}>
                {profile?.avatar_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : getInitials(profile?.username ?? 'U')}
              </div>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5 mb-1.5">
                  <span className={cn('text-sm font-semibold truncate', isMe ? 'text-[#e11d48]' : 'text-[#f4f4f5]')}>
                    {profile?.username ?? 'Unknown'}
                  </span>
                  {isMe && (
                    <span className="text-[9px] text-[#e11d48]/50 font-medium shrink-0">you</span>
                  )}
                </div>
                <div className="h-px rounded-full bg-[#1a1a1a] overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', isMe ? 'bg-[#e11d48]' : 'bg-[#333]')}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              {/* Points */}
              <div className="text-right shrink-0 tabular-nums">
                <span
                  className={cn('leading-none', isMe ? 'text-[#e11d48]' : 'text-[#f4f4f5]')}
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '1.3rem' }}
                >
                  {totalPts}
                </span>
                <span className="text-[9px] text-[#52525b] ml-0.5">pts</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Compact sticky bar — rendered in a portal to escape any ancestor transform/stacking context
          that would break position:fixed (e.g. page-enter animation with forwards fill) */}
      {mounted && createPortal(
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          top: '56px',
          zIndex: 30,
          opacity: isSticky ? 1 : 0,
          transform: isSticky ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          pointerEvents: isSticky ? 'auto' : 'none',
        }}
      >
        <div className="bg-[#0d0d0d]/95 backdrop-blur-md border-b border-[#1e1e1e] shadow-lg">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-0 overflow-x-auto scrollbar-none py-2">
              {leaderboard.map(({ uid, profile, totalPts }, idx) => {
                const isMe = uid === currentUserId
                const rank = idx + 1
                const isFirst = rank === 1

                return (
                  <div
                    key={uid}
                    className={cn(
                      'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg shrink-0 transition-colors',
                      isMe ? 'bg-[#e11d48]/8' : ''
                    )}
                  >
                    {/* Avatar */}
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold overflow-hidden border',
                      isMe
                        ? 'bg-[#e11d48]/20 border-[#e11d48]/40 text-[#e11d48]'
                        : isFirst
                          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                          : 'bg-[#1a1a1a] border-[#222] text-[#52525b]'
                    )}>
                      {profile?.avatar_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        : getInitials(profile?.username ?? 'U')}
                    </div>

                    {/* Name */}
                    <span
                      className={cn(
                        'text-[10px] leading-none font-medium',
                        isMe ? 'text-[#e11d48]' : isFirst ? 'text-yellow-300' : 'text-[#d4d4d8]'
                      )}
                    >
                      {profile?.username ?? '?'}
                    </span>

                    {/* Points */}
                    <span
                      className={cn(
                        'tabular-nums leading-none',
                        isMe ? 'text-[#e11d48]' : isFirst ? 'text-yellow-400' : 'text-[#71717a]'
                      )}
                      style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '0.8rem' }}
                    >
                      {totalPts}
                    </span>
                  </div>
                )
              })}

              {/* Live/Final indicator */}
              {(isLive || isCompleted) && (
                <div className="ml-auto pl-3 shrink-0">
                  {isLive ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#e11d48]/10 border border-[#e11d48]/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse" />
                      <span className="text-[9px] font-bold text-[#e11d48] tracking-widest uppercase">Live</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#1e1e1e] border border-[#27272a]">
                      <span className="text-[9px] font-bold text-[#52525b] tracking-widest uppercase">Final</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      , document.body)}
    </>
  )
}
