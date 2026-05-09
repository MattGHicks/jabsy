'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { Trash2, AlertTriangle, X, CheckCircle2 } from 'lucide-react'
import { FightPickCard } from './fight-pick-card'
import { clearAllPicks } from '@/actions/picks'

interface Fight {
  id: string
  bout_order: number
  is_main_event: boolean
  scheduled_rounds: number
  weight_class: string | null
  red_name: string
  red_record: string | null
  red_sherdog_url: string | null
  blue_name: string
  blue_record: string | null
  blue_sherdog_url: string | null
  status: string
  matchup_preview: string | null
}

interface ExistingPick {
  pick_winner: string
  pick_method: string
  pick_round: number | null
}

interface PicksPageClientProps {
  fights: Fight[]
  leagueId: string
  eventId: string
  picksMap: Record<string, ExistingPick>
  isLocked: boolean
  activeFightsCount: number
}

export function PicksPageClient({ fights, leagueId, eventId, picksMap, isLocked, activeFightsCount }: PicksPageClientProps) {
  const router = useRouter()

  // Track which fights have a complete pick (winner + method + round if required)
  const [completedFights, setCompletedFights] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const [fightId] of Object.entries(picksMap)) {
      initial.add(fightId)
    }
    return initial
  })

  // Bump this to force-remount all fight cards (resets their local state after clear)
  const [clearKey, setClearKey] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [showDoneModal, setShowDoneModal] = useState(false)
  const [isClearing, startClearing] = useTransition()

  // Show completion modal the first time all picks are done (not on initial load)
  const prevAllDone = useRef(false)
  const initiallyAllDone = useRef(Object.keys(picksMap).length >= activeFightsCount && activeFightsCount > 0)

  const pickedCount = completedFights.size

  function handlePickSaved(fightId: string, isComplete: boolean) {
    setCompletedFights((prev) => {
      const next = new Set(prev)
      if (isComplete) next.add(fightId)
      else next.delete(fightId)
      return next
    })
  }

  function handleConfirmClear() {
    startClearing(async () => {
      await clearAllPicks(leagueId, eventId)
      setCompletedFights(new Set())
      setClearKey((k) => k + 1)
      setShowModal(false)
      // Reset so the completion modal fires again when they re-pick everything
      initiallyAllDone.current = false
      prevAllDone.current = false
    })
  }

  const pct = activeFightsCount > 0 ? (pickedCount / activeFightsCount) * 100 : 0
  const allDone = pickedCount >= activeFightsCount && activeFightsCount > 0
  const hasPicks = pickedCount > 0

  // Fire completion modal when user finishes their last pick (not on page load)
  useEffect(() => {
    if (allDone && !prevAllDone.current && !initiallyAllDone.current) {
      setShowDoneModal(true)
    }
    prevAllDone.current = allDone
  }, [allDone])

  return (
    <>
      {/* Sticky picks status bar */}
      {!isLocked && (
        <div className="sticky top-14 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[#1e1e1e] mb-6">
          <div className="max-w-6xl mx-auto flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-sm font-bold tabular-nums ${allDone ? 'text-green-400' : 'text-[#f4f4f5]'}`}
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
              >
                {pickedCount}/{activeFightsCount}
              </span>
              <span className="text-xs text-[#52525b]">picks</span>
            </div>
            <div className="flex-1 h-1 rounded-full bg-[#1e1e1e] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-[#e11d48]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {allDone && (
              <span className="text-[11px] font-semibold text-green-400 shrink-0">All done ✓</span>
            )}
          </div>
        </div>
      )}

      {/* Fight cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {fights.map((fight) => (
          <FightPickCard
            key={`${clearKey}-${fight.id}`}
            fight={fight}
            leagueId={leagueId}
            eventId={eventId}
            existingPick={clearKey === 0 ? (picksMap[fight.id] ?? null) : null}
            isLocked={isLocked || fight.status === 'cancelled'}
            onPickSaved={handlePickSaved}
          />
        ))}
      </div>

      {/* Clear all picks button */}
      {!isLocked && hasPicks && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-xs font-semibold border border-[#27272a] text-[#52525b] hover:text-[#e11d48] hover:border-[#e11d48]/30 hover:bg-[#e11d48]/5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Picks
          </button>
        </div>
      )}

      {/* All picks done modal */}
      {showDoneModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setShowDoneModal(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-[#141414] border border-[#27272a] shadow-2xl overflow-hidden">
            {/* Red top bar */}
            <div className="h-1 w-full bg-[#e11d48]" />

            <div className="p-7">
              {/* Icon */}
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/25 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
              </div>

              {/* Heading */}
              <h2
                className="text-center text-[#f4f4f5] uppercase leading-tight mb-2"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '1.75rem' }}
              >
                Picks are in!
              </h2>
              <p className="text-center text-sm text-[#71717a] mb-2">
                All <span className="text-[#f4f4f5] font-semibold">{activeFightsCount}/{activeFightsCount}</span> picks submitted.
              </p>
              <p className="text-center text-xs text-[#52525b] mb-7 leading-relaxed">
                You can still edit any pick before the event locks. Good luck!
              </p>

              {/* CTA */}
              <button
                onClick={() => {
                  setShowDoneModal(false)
                  router.push(`/leagues/${leagueId}/events/${eventId}/board`)
                }}
                className="w-full h-11 rounded-lg bg-[#e11d48] hover:bg-[#be123c] text-white text-sm font-semibold transition-colors cursor-pointer"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700, letterSpacing: '0.04em' }}
              >
                VIEW THE BOARD
              </button>
              <button
                onClick={() => setShowDoneModal(false)}
                className="w-full mt-2.5 h-9 rounded-lg text-xs text-[#52525b] hover:text-[#71717a] transition-colors cursor-pointer"
              >
                Stay & review picks
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation modal — portaled to body so scroll position doesn't affect it */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !isClearing && setShowModal(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm rounded-xl bg-[#141414] border border-[#27272a] shadow-2xl p-6">
            {/* Close button */}
            <button
              onClick={() => !isClearing && setShowModal(false)}
              className="absolute top-4 right-4 text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Icon + heading */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-[#e11d48]" />
              </div>
              <div>
                <h2
                  className="text-[#f4f4f5] uppercase leading-tight"
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.25rem' }}
                >
                  Clear All Picks?
                </h2>
                <p className="text-xs text-[#71717a] mt-0.5">This cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-[#a1a1aa] mb-6">
              All <span className="text-[#f4f4f5] font-semibold">{pickedCount}</span> of your picks for this event will be permanently deleted. You can re-pick any time before the event locks.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => !isClearing && setShowModal(false)}
                disabled={isClearing}
                className="flex-1 h-10 rounded-lg text-sm font-semibold border border-[#27272a] bg-[#1e1e1e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                disabled={isClearing}
                className="flex-1 h-10 rounded-lg text-sm font-semibold bg-[#e11d48] hover:bg-[#be123c] text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? 'Clearing…' : 'Yes, clear all'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
