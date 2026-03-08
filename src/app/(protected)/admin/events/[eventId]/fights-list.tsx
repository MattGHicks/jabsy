'use client'

import { useState } from 'react'
import { Swords, Trash2, ChevronDown } from 'lucide-react'
import { deleteFight, setFightStatus } from '@/actions/admin'
import { cn } from '@/lib/utils'
import type { Fight } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  live: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
  final: 'bg-green-500/10 text-green-400 border-green-500/20',
  cancelled: 'bg-zinc-900 text-zinc-600 border-zinc-800',
  no_contest: 'bg-zinc-900 text-zinc-600 border-zinc-800',
}

const FIGHT_STATUSES = ['scheduled', 'live', 'final', 'cancelled', 'no_contest']

interface FightsListProps {
  fights: Fight[]
  eventId: string
}

export function FightsList({ fights, eventId }: FightsListProps) {
  const [statusPending, setStatusPending] = useState<string | null>(null)

  if (fights.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center bg-[#141414] border border-[#1e1e1e] rounded-lg">
        <Swords className="w-7 h-7 text-[#52525b] mb-3" />
        <p className="text-sm text-[#71717a]">No fights added yet. Use the form below to add fights.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-[#71717a] uppercase tracking-widest mb-1">
        {fights.length} {fights.length === 1 ? 'Fight' : 'Fights'} — Ordered by Bout Order
      </p>
      {fights.map((fight) => (
        <div
          key={fight.id}
          className="p-4 rounded-lg bg-[#141414] border border-[#1e1e1e] hover:border-[#27272a] transition-colors"
        >
          <div className="flex items-start gap-4">
            {/* Bout order */}
            <div className="w-7 h-7 rounded-md bg-[#1e1e1e] border border-[#27272a] flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-[#71717a]">{fight.bout_order}</span>
            </div>

            {/* Fight details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-semibold text-[#e11d48]">{fight.red_name}</span>
                {fight.red_record && <span className="text-xs text-[#52525b]">({fight.red_record})</span>}
                <span className="text-xs text-[#52525b] font-medium">VS</span>
                <span className="text-sm font-semibold text-blue-400">{fight.blue_name}</span>
                {fight.blue_record && <span className="text-xs text-[#52525b]">({fight.blue_record})</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-[#71717a]">
                <span>{fight.scheduled_rounds} Rounds</span>
                {fight.is_main_event && (
                  <><span>·</span><span className="text-[#e11d48] font-semibold">Main Event</span></>
                )}
              </div>
            </div>

            {/* Status & actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Status select */}
              <div className="relative">
                <select
                  defaultValue={fight.status}
                  disabled={statusPending === fight.id}
                  onChange={async (e) => {
                    setStatusPending(fight.id)
                    await setFightStatus(fight.id, e.target.value as 'scheduled' | 'live' | 'final' | 'cancelled' | 'no_contest', eventId)
                    setStatusPending(null)
                  }}
                  className={cn(
                    'h-7 pl-2 pr-6 rounded-md text-xs font-semibold border appearance-none cursor-pointer focus:outline-none transition-colors',
                    STATUS_STYLES[fight.status] ?? STATUS_STYLES.scheduled
                  )}
                >
                  {FIGHT_STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-[#1e1e1e] text-[#f4f4f5]">
                      {s.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delete */}
              <form action={async () => {
                await deleteFight(fight.id, eventId)
              }}>
                <button
                  type="submit"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-[#52525b] hover:text-[#e11d48] hover:bg-[#e11d48]/5 transition-colors cursor-pointer"
                  title="Delete fight"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
