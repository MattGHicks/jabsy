'use client'

import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'

interface LockCountdownProps {
  lockTime: string | null
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Locked'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

export function LockCountdown({ lockTime }: LockCountdownProps) {
  const [msLeft, setMsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!lockTime) return
    const update = () => setMsLeft(new Date(lockTime).getTime() - Date.now())
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [lockTime])

  if (!lockTime) {
    return <span className="text-[#52525b]">No lock set</span>
  }

  if (msLeft === null) return null

  const isLocked = msLeft <= 0
  const isUrgent = !isLocked && msLeft < 3_600_000 // under 1 hour

  return (
    <span className={isLocked ? 'text-zinc-500' : isUrgent ? 'text-[#e11d48] font-semibold' : 'text-[#a1a1aa]'}>
      <Lock className="w-3 h-3 inline mr-1 -mt-px" />
      {isLocked ? 'Picks locked' : `Locks in ${formatCountdown(msLeft)}`}
    </span>
  )
}
