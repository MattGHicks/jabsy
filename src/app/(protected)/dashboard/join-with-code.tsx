'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, Loader2, ArrowRight } from 'lucide-react'
import { joinViaInvite } from '@/actions/invites'

export function JoinWithCode() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleJoin() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setError(null)
    startTransition(async () => {
      const result = await joinViaInvite(trimmed)
      if ('error' in result) {
        setError(result.error ?? 'Something went wrong')
      } else if (result.leagueId) {
        router.push(`/leagues/${result.leagueId}`)
        router.refresh()
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleJoin()
  }

  const hasCode = code.trim().length > 0

  return (
    <div className="flex items-center gap-4 p-5 rounded-xl bg-[#111111] border border-[#1e1e1e]">
      {/* Icon */}
      <div className="w-11 h-11 rounded-xl bg-[#0a0a0a] border border-[#1e1e1e] flex items-center justify-center shrink-0">
        <Ticket className="w-5 h-5 text-[#52525b]" />
      </div>

      {/* Label + input */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-2">Join a League</p>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); setError(null) }}
            onKeyDown={handleKeyDown}
            placeholder="ENTER CODE"
            maxLength={8}
            disabled={isPending}
            className="w-full h-9 pl-3 pr-10 rounded-lg bg-[#0a0a0a] border border-[#1e1e1e] text-sm text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#27272a] font-mono tracking-[0.2em] uppercase disabled:opacity-50 transition-colors"
          />
          {hasCode && (
            <button
              onClick={handleJoin}
              disabled={isPending}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-[#e11d48] flex items-center justify-center hover:bg-[#be123c] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isPending
                ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                : <ArrowRight className="w-3 h-3 text-white" />
              }
            </button>
          )}
        </div>
        {error && (
          <p className="text-[11px] text-[#e11d48] mt-2">{error}</p>
        )}
      </div>
    </div>
  )
}
