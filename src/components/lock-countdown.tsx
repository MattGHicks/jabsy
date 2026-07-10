'use client'

import { useEffect, useState } from 'react'

function partsFor(lockTime: string, now: number) {
  const diff = new Date(lockTime).getTime() - now
  const total = Math.max(0, Math.floor(diff / 1000))
  return {
    total,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    mins: Math.floor((total % 3600) / 60),
    secs: total % 60,
  }
}

const pad = (n: number) => n.toString().padStart(2, '0')

/**
 * Live-ticking countdown to a pick lock time.
 *
 * - `inline`: single-line text ("1D 22:41:03"), inherits font/size from parent,
 *   turns corner-red inside the final hour. Used on the dashboard hero.
 * - `clock`: segmented fight-clock boxes (D/H/M/S with labels). Used on the
 *   public landing card.
 *
 * Server render and first client render both compute from the current clock,
 * so the leaf text carries suppressHydrationWarning for the sub-second drift.
 */
export function LockCountdown({
  lockTime,
  variant = 'inline',
}: {
  lockTime: string
  variant?: 'inline' | 'clock'
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { total, days, hours, mins, secs } = partsFor(lockTime, now)
  const urgent = total > 0 && total < 3600

  if (variant === 'clock') {
    const segments: { value: string; label: string }[] = [
      ...(days > 0 ? [{ value: days.toString(), label: days === 1 ? 'day' : 'days' }] : []),
      { value: pad(hours), label: 'hrs' },
      { value: pad(mins), label: 'min' },
      { value: pad(secs), label: 'sec' },
    ]

    if (total === 0) {
      return (
        <span
          className="text-sm font-black text-[#e11d48] uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
        >
          Picks Locked
        </span>
      )
    }

    return (
      <span className="flex items-center gap-1.5" suppressHydrationWarning>
        {segments.map((s) => (
          <span
            key={s.label}
            className={`flex flex-col items-center rounded-md px-2 py-1 min-w-[44px] border ${
              urgent ? 'bg-[#e11d48]/10 border-[#e11d48]/30' : 'bg-[#0a0a0a] border-[#27272a]'
            }`}
          >
            <span
              className={`text-xl leading-none ${urgent ? 'text-[#e11d48]' : 'text-[#f4f4f5]'}`}
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}
              suppressHydrationWarning
            >
              {s.value}
            </span>
            <span className="text-[8px] text-[#52525b] uppercase tracking-[0.15em] mt-0.5">{s.label}</span>
          </span>
        ))}
      </span>
    )
  }

  // inline
  if (total === 0) {
    return <span style={{ color: '#e11d48' }}>Locked</span>
  }

  return (
    <span
      style={{ fontVariantNumeric: 'tabular-nums', ...(urgent ? { color: '#e11d48' } : {}) }}
      suppressHydrationWarning
    >
      {days > 0 ? `${days}D ` : ''}
      {pad(hours)}:{pad(mins)}:{pad(secs)}
    </span>
  )
}
