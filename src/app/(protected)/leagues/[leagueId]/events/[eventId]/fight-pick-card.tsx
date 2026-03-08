'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { savePick } from '@/actions/picks'

interface Fight {
  id: string
  bout_order: number
  is_main_event: boolean
  scheduled_rounds: number
  red_name: string
  red_record: string | null
  red_sherdog_url: string | null
  blue_name: string
  blue_record: string | null
  blue_sherdog_url: string | null
  status: string
}

interface ExistingPick {
  pick_winner: string
  pick_method: string
  pick_round: number | null
}

interface FightPickCardProps {
  fight: Fight
  leagueId: string
  eventId: string
  existingPick: ExistingPick | null
  isLocked: boolean
  onPickSaved?: (fightId: string, isComplete: boolean) => void
}

const METHOD_LABELS: Record<string, string> = {
  ko_tko: 'KO/TKO',
  submission: 'Submission',
  decision: 'Decision',
}

const ROUND_ELIGIBLE_METHODS = ['ko_tko', 'submission']

export function FightPickCard({ fight, leagueId, eventId, existingPick, isLocked, onPickSaved }: FightPickCardProps) {
  const [winner, setWinner] = useState<string | null>(existingPick?.pick_winner ?? null)
  const [method, setMethod] = useState<string | null>(existingPick?.pick_method ?? null)
  const [round, setRound] = useState<number | null>(existingPick?.pick_round ?? null)
  const [isPending, startTransition] = useTransition()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [methodFlash, setMethodFlash] = useState(false)
  const [roundFlash, setRoundFlash] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const roundFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCancelled = fight.status === 'cancelled'
  const hasPick = !!winner && !!method && (!ROUND_ELIGIBLE_METHODS.includes(method) || !!round)
  const isPartial = !hasPick && !!winner

  // Flash the METHOD label when winner is selected but method hasn't been chosen yet
  useEffect(() => {
    if (winner && !method) {
      setMethodFlash(true)
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
      flashTimeoutRef.current = setTimeout(() => setMethodFlash(false), 2500)
    }
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner])

  // Flash the ROUND label when a round-eligible method is selected but round hasn't been chosen
  useEffect(() => {
    if (method && ROUND_ELIGIBLE_METHODS.includes(method) && !round) {
      setRoundFlash(true)
      if (roundFlashTimeoutRef.current) clearTimeout(roundFlashTimeoutRef.current)
      roundFlashTimeoutRef.current = setTimeout(() => setRoundFlash(false), 2500)
    }
    return () => {
      if (roundFlashTimeoutRef.current) clearTimeout(roundFlashTimeoutRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method])

  function triggerSave(w: string, m: string, r: number | null) {
    if (isLocked) return
    if (ROUND_ELIGIBLE_METHODS.includes(m) && !r) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      setSaveState('idle')
      return
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    const fd = new FormData()
    fd.set('fight_id', fight.id)
    fd.set('league_id', leagueId)
    fd.set('event_id', eventId)
    fd.set('pick_winner', w)
    fd.set('pick_method', m)
    if (r && ROUND_ELIGIBLE_METHODS.includes(m)) fd.set('pick_round', String(r))
    const isComplete = !!w && !!m && (!ROUND_ELIGIBLE_METHODS.includes(m) || !!r)
    startTransition(async () => {
      setSaveState('saving')
      const result = await savePick(fd)
      if (result && 'error' in result) {
        setSaveState('error')
        saveTimeoutRef.current = setTimeout(() => setSaveState('idle'), 3000)
      } else {
        setSaveState('saved')
        onPickSaved?.(fight.id, isComplete)
        saveTimeoutRef.current = setTimeout(() => setSaveState('idle'), 2000)
      }
    })
  }

  function handleWinnerChange(w: string) {
    setWinner(w)
    if (method) triggerSave(w, method, round)
  }

  function handleMethodChange(m: string) {
    const newRound = ROUND_ELIGIBLE_METHODS.includes(m) ? round : null
    setMethod(m)
    setMethodFlash(false)
    if (!ROUND_ELIGIBLE_METHODS.includes(m)) {
      setRound(null)
      setRoundFlash(false)
    }
    if (winner) triggerSave(winner, m, newRound)
  }

  function handleRoundChange(r: number) {
    const newRound = round === r ? null : r
    setRound(newRound)
    setRoundFlash(false)
    if (winner && method) triggerSave(winner, method, newRound)
  }

  return (
    <div className={cn(
      'rounded-xl border transition-colors',
      isCancelled
        ? 'border-[#1e1e1e] bg-[#0e0e0e] opacity-50'
        : hasPick
          ? 'border-[#e11d48]/20 bg-[#141414]'
          : 'border-[#1e1e1e] bg-[#141414]'
    )}>
      {/* Fight header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {fight.is_main_event && (
              <span className="text-[10px] font-bold tracking-widest text-[#e11d48] uppercase">Main Event</span>
            )}
            {isCancelled && (
              <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Cancelled</span>
            )}
          </div>
          {/* Pick status + save indicator */}
          {!isLocked && !isCancelled && (
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-[10px] font-medium transition-opacity duration-300',
                saveState === 'saving' ? 'text-[#71717a] opacity-100' : '',
                saveState === 'saved' ? 'text-green-400 opacity-100' : '',
                saveState === 'error' ? 'text-[#e11d48] opacity-100' : '',
                saveState === 'idle' ? 'opacity-0' : '',
              )}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Picks locked' : '✓ Saved'}
              </span>
              {hasPick ? (
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Pick complete" />
              ) : isPartial ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Pick incomplete" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#27272a] shrink-0" title="No pick" />
              )}
            </div>
          )}
        </div>

        {/* Matchup */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <p
                className="text-[#f4f4f5] leading-tight uppercase"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.15rem' }}
              >
                {fight.red_name}
              </p>
              {fight.red_sherdog_url && (
                <a
                  href={fight.red_sherdog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title={`View ${fight.red_name} on Sherdog`}
                  className="shrink-0 text-[#e11d48]/40 hover:text-[#e11d48] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {fight.red_record && (
              <p className="text-[11px] text-[#71717a] mt-0.5">{fight.red_record}</p>
            )}
          </div>
          <div className="text-center">
            <span className="text-xs font-bold text-[#3f3f46]">VS</span>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              {fight.blue_sherdog_url && (
                <a
                  href={fight.blue_sherdog_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title={`View ${fight.blue_name} on Sherdog`}
                  className="shrink-0 text-blue-400/40 hover:text-blue-400 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <p
                className="text-[#f4f4f5] leading-tight uppercase"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.15rem' }}
              >
                {fight.blue_name}
              </p>
            </div>
            {fight.blue_record && (
              <p className="text-[11px] text-[#71717a] mt-0.5">{fight.blue_record}</p>
            )}
          </div>
        </div>
      </div>

      {/* Pick form */}
      {!isCancelled && (
        <div className="p-4 flex flex-col gap-4">
          {/* Winner selection */}
          <div>
            <p className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest mb-2">Pick Winner</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'red', label: fight.red_name },
                { value: 'blue', label: fight.blue_name },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => !isLocked && handleWinnerChange(value)}
                  disabled={isLocked}
                  className={cn(
                    'h-10 px-3 rounded-lg text-sm font-semibold border transition-all truncate',
                    isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    winner === value
                      ? value === 'red'
                        ? 'bg-[#e11d48]/15 border-[#e11d48]/40 text-[#e11d48]'
                        : 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                      : 'bg-[#1a1a1a] border-[#27272a] text-[#71717a] hover:border-[#3f3f46] hover:text-[#a1a1aa]'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Method */}
          {winner && (
            <div>
              <p className={cn(
                'text-[10px] font-bold uppercase tracking-widest mb-2 transition-colors duration-300',
                methodFlash ? 'text-amber-400 animate-pulse' : 'text-[#52525b]'
              )}>
                {methodFlash ? '→ Now pick a method' : 'Method'}
              </p>
              <div className="flex gap-2 flex-wrap">
                {['ko_tko', 'submission', 'decision'].map((m) => (
                  <button
                    key={m}
                    onClick={() => !isLocked && handleMethodChange(m)}
                    disabled={isLocked}
                    className={cn(
                      'h-8 px-3 rounded-lg text-xs font-semibold border transition-all',
                      isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                      method === m
                        ? 'bg-[#27272a] border-[#3f3f46] text-[#f4f4f5]'
                        : 'bg-[#1a1a1a] border-[#27272a] text-[#71717a] hover:border-[#3f3f46] hover:text-[#a1a1aa]'
                    )}
                  >
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Round */}
          {winner && method && ROUND_ELIGIBLE_METHODS.includes(method) && (
            <div>
              <p className={cn(
                'text-[10px] font-bold uppercase tracking-widest mb-2 transition-colors duration-300',
                roundFlash ? 'text-amber-400 animate-pulse' : 'text-[#52525b]'
              )}>
                {roundFlash ? '→ Now pick a round' : <>Round <span className="text-[#3f3f46] normal-case">(+2 pts if correct)</span></>}
              </p>
              <div className="flex gap-2">
                {Array.from({ length: fight.scheduled_rounds }, (_, i) => i + 1).map((r) => (
                  <button
                    key={r}
                    onClick={() => !isLocked && handleRoundChange(r)}
                    disabled={isLocked}
                    className={cn(
                      'w-9 h-9 rounded-lg text-sm font-bold border transition-all',
                      isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                      round === r
                        ? 'bg-[#27272a] border-[#3f3f46] text-[#f4f4f5]'
                        : 'bg-[#1a1a1a] border-[#27272a] text-[#71717a] hover:border-[#3f3f46] hover:text-[#a1a1aa]'
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Locked pick summary */}
          {isLocked && existingPick && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[#52525b]">Your pick:</span>
              <span className="text-xs font-semibold text-[#a1a1aa]">
                {existingPick.pick_winner === 'red' ? fight.red_name : fight.blue_name}
                {' · '}{METHOD_LABELS[existingPick.pick_method]}
                {existingPick.pick_round ? ` R${existingPick.pick_round}` : ''}
              </span>
            </div>
          )}

          {/* No pick when locked */}
          {isLocked && !existingPick && (
            <p className="text-xs text-[#52525b] pt-1">No pick made</p>
          )}
        </div>
      )}
    </div>
  )
}
