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
      {/* ── Full standings ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {leaderboard.map(({ uid, profile, totalPts }, idx) => {
          const isMe = uid === currentUserId
          const rank = idx + 1
          const isFirst = rank === 1
          const barPct = maxPts > 0 ? Math.round((totalPts / maxPts) * 100) : 0

          return (
            <div
              key={uid}
              className={cn(
                'relative flex items-center gap-3 px-4 py-3.5 rounded-xl border overflow-hidden',
                isFirst && isMe
                  ? 'bg-[#e11d48]/5 border-[#e11d48]/25'
                  : isFirst
                  ? 'bg-yellow-500/[0.04] border-yellow-500/20'
                  : isMe
                  ? 'bg-[#e11d48]/5 border-[#e11d48]/20'
                  : 'bg-[#0f0f0f] border-[#1a1a1a]'
              )}
            >
              {/* Watermark rank */}
              <span
                className="absolute right-3 top-1/2 -translate-y-1/2 leading-none select-none pointer-events-none"
                style={{
                  fontFamily: 'var(--font-barlow)',
                  fontWeight: 900,
                  fontSize: '4.5rem',
                  color: isFirst
                    ? 'rgba(234,179,8,0.07)'
                    : isMe
                    ? 'rgba(225,29,72,0.07)'
                    : 'rgba(255,255,255,0.03)',
                }}
              >
                {rank}
              </span>

              {/* Rank icon */}
              <div className="w-5 shrink-0 flex justify-center">
                {rank === 1 ? (
                  <Crown className="w-4 h-4 text-yellow-400" />
                ) : rank === 2 ? (
                  <span
                    className="text-sm text-[#71717a]"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
                  >
                    2
                  </span>
                ) : rank === 3 ? (
                  <span
                    className="text-sm text-amber-700"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
                  >
                    3
                  </span>
                ) : (
                  <span
                    className="text-sm text-[#3f3f46]"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
                  >
                    {rank}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden shrink-0',
                  isMe
                    ? 'ring-2 ring-[#e11d48] ring-offset-1 ring-offset-[#0a0a0a]'
                    : isFirst
                    ? 'ring-2 ring-yellow-500/40 ring-offset-1 ring-offset-[#0a0a0a]'
                    : 'border border-[#222]'
                )}
                style={{
                  background: isMe
                    ? 'rgba(225,29,72,0.15)'
                    : isFirst
                    ? 'rgba(234,179,8,0.08)'
                    : '#1a1a1a',
                  color: isMe ? '#e11d48' : isFirst ? '#fbbf24' : '#71717a',
                }}
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  getInitials(profile?.username ?? 'U')
                )}
              </div>

              {/* Name + progress bar */}
              <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      'text-sm font-bold truncate',
                      isMe ? 'text-[#e11d48]' : isFirst ? 'text-yellow-200' : 'text-[#e4e4e7]'
                    )}
                  >
                    {profile?.username ?? 'Unknown'}
                  </span>
                  {isMe && (
                    <span className="text-[9px] text-[#e11d48]/40 font-bold uppercase tracking-wider shrink-0">
                      you
                    </span>
                  )}
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <div
                    className={cn('h-full rounded-full transition-all duration-700')}
                    style={{
                      width: `${barPct}%`,
                      background: isFirst
                        ? 'linear-gradient(90deg, #ca8a04, #fbbf24)'
                        : isMe
                        ? '#e11d48'
                        : '#2e2e2e',
                    }}
                  />
                </div>
              </div>

              {/* Points */}
              <div className="shrink-0 text-right relative z-10">
                <span
                  className={cn(
                    'tabular-nums leading-none',
                    isFirst ? 'text-yellow-400' : isMe ? 'text-[#e11d48]' : 'text-[#f4f4f5]'
                  )}
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '1.7rem', lineHeight: 1 }}
                >
                  {totalPts}
                </span>
                <span className="block text-[9px] text-[#52525b] mt-0.5 tracking-wider">PTS</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Compact sticky broadcast bar ──────────────────────────── */}
      {mounted && createPortal(
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            top: '56px',
            zIndex: 30,
            opacity: isSticky ? 1 : 0,
            transform: isSticky ? 'translateY(0)' : 'translateY(-8px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: isSticky ? 'auto' : 'none',
          }}
        >
          <div
            className="border-b border-[#1e1e1e] shadow-xl"
            style={{ background: 'rgba(8,8,8,0.96)', backdropFilter: 'blur(16px)' }}
          >
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="flex items-stretch overflow-x-auto scrollbar-none" style={{ height: '52px' }}>

                {/* Live / Final badge */}
                {(isLive || isCompleted) && (
                  <div className="flex items-center pr-3 mr-1 shrink-0 border-r border-[#1e1e1e]">
                    {isLive ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse" />
                        <span
                          className="text-[#e11d48] tracking-widest uppercase"
                          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '0.65rem' }}
                        >
                          Live
                        </span>
                      </div>
                    ) : (
                      <span
                        className="text-[#52525b] tracking-widest uppercase"
                        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '0.65rem' }}
                      >
                        Final
                      </span>
                    )}
                  </div>
                )}

                {/* Player slots */}
                {leaderboard.map(({ uid, profile, totalPts }, idx) => {
                  const isMe = uid === currentUserId
                  const rank = idx + 1
                  const isFirst = rank === 1

                  return (
                    <div
                      key={uid}
                      className={cn(
                        'flex items-center gap-2 px-3 shrink-0 border-r border-[#111]',
                        isMe
                          ? 'bg-[#e11d48]/[0.06]'
                          : isFirst
                          ? 'bg-yellow-500/[0.04]'
                          : ''
                      )}
                    >
                      {/* Rank */}
                      <span
                        className={cn(
                          'tabular-nums w-4 text-center leading-none',
                          isFirst ? 'text-yellow-500' : 'text-[#3f3f46]'
                        )}
                        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '0.75rem' }}
                      >
                        {rank}
                      </span>

                      {/* Avatar */}
                      <div
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold overflow-hidden shrink-0',
                          isMe
                            ? 'ring-1 ring-[#e11d48]'
                            : isFirst
                            ? 'ring-1 ring-yellow-500/40'
                            : 'border border-[#222]'
                        )}
                        style={{
                          background: isMe
                            ? 'rgba(225,29,72,0.15)'
                            : isFirst
                            ? 'rgba(234,179,8,0.08)'
                            : '#1a1a1a',
                          color: isMe ? '#e11d48' : isFirst ? '#fbbf24' : '#52525b',
                        }}
                      >
                        {profile?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          getInitials(profile?.username ?? 'U')
                        )}
                      </div>

                      {/* Name + pts */}
                      <div className="flex flex-col justify-center">
                        <span
                          className={cn(
                            'leading-none mb-0.5 font-semibold',
                            isMe ? 'text-[#e11d48]' : isFirst ? 'text-yellow-300' : 'text-[#a1a1aa]'
                          )}
                          style={{ fontSize: '0.62rem' }}
                        >
                          {(profile?.username ?? '?').slice(0, 10)}
                        </span>
                        <span
                          className={cn(
                            'tabular-nums leading-none',
                            isMe ? 'text-[#e11d48]' : isFirst ? 'text-yellow-400' : 'text-[#e4e4e7]'
                          )}
                          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '1.05rem' }}
                        >
                          {totalPts}
                          <span
                            className="text-[#52525b] ml-0.5"
                            style={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '0.55rem' }}
                          >
                            pts
                          </span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
