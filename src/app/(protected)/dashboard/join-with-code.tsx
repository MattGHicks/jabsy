'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Hash, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { joinViaInvite } from '@/actions/invites'

export function JoinWithCode() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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

  return (
    <div className="mt-6 flex flex-col items-center">
      <button
        onClick={() => { setOpen((o) => !o); setError(null) }}
        className="inline-flex items-center gap-1.5 text-xs text-[#52525b] hover:text-[#71717a] transition-colors cursor-pointer"
      >
        <Hash className="w-3.5 h-3.5" />
        Have an invite code?
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="mt-3 w-full max-w-xs">
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              onKeyDown={handleKeyDown}
              placeholder="Enter code (e.g. AB12CD34)"
              maxLength={8}
              disabled={isPending}
              className="flex-1 h-9 px-3 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-sm text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 font-mono tracking-widest uppercase disabled:opacity-50"
            />
            <button
              onClick={handleJoin}
              disabled={isPending || code.trim().length === 0}
              className="h-9 px-4 rounded-lg bg-[#e11d48] text-white text-xs font-semibold hover:bg-[#be123c] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Join'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-[#e11d48] text-center">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
