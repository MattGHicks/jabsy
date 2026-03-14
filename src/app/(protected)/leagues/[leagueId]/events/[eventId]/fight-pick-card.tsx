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
  submission: 'SUB',
  decision: 'DEC',
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

  // Split first and last name for stacked display
  function splitName(name: string) {
    const parts = name.trim().split(/\s+/)
    if (parts.length <= 1) return { first: '', last: name }
    return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
  }

  const redName = splitName(fight.red_name)
  const blueName = splitName(fight.blue_name)

  const showRounds = winner && method && ROUND_ELIGIBLE_METHODS.includes(method)
  const hasSherdog = fight.red_sherdog_url || fight.blue_sherdog_url

  return (
    <div className={cn(
      'rounded-xl overflow-hidden transition-colors',
      isCancelled
        ? 'border border-[#1e1e1e] bg-[#0e0e0e] opacity-50'
        : hasPick
          ? 'border border-[#e11d48]/20 bg-[#111111]'
          : 'border border-[#1e1e1e] bg-[#111111]'
    )}>
      {/* Main Event badge */}
      {fight.is_main_event && (
        <div className="flex items-center justify-center py-1.5 bg-[#e11d48]/8 border-b border-[#e11d48]/15">
          <span className="text-[9px] font-bold tracking-[0.25em] text-[#e11d48] uppercase">Main Event</span>
        </div>
      )}

      {/* Fighter matchup — clickable to select winner */}
      <div className="grid grid-cols-[1fr_auto_1fr]">
        {/* Red corner */}
        <button
          onClick={() => !isLocked && !isCancelled && handleWinnerChange('red')}
          disabled={isLocked || isCancelled}
          className={cn(
            'relative py-4 px-3 text-left transition-all group/red',
            isLocked || isCancelled ? 'cursor-default' : 'cursor-pointer',
            !winner || winner !== 'red' ? '' : ''
          )}
          style={winner === 'red'
            ? { background: 'linear-gradient(to right, rgba(225,29,72,0.12), transparent)' }
            : undefined
          }
          onMouseEnter={(e) => {
            if (!isLocked && !isCancelled && winner !== 'red') {
              e.currentTarget.style.background = 'linear-gradient(to right, rgba(225,29,72,0.04), transparent)'
            }
          }}
          onMouseLeave={(e) => {
            if (winner !== 'red') e.currentTarget.style.background = ''
          }}
        >
          {/* Corner accent bar */}
          <div className={cn(
            'absolute left-0 top-0 bottom-0 w-[3px] transition-all',
            winner === 'red' ? 'bg-[#e11d48]' : 'bg-[#e11d48]/20'
          )} />

          <div className="pl-2">
            {redName.first && (
              <p className="text-[10px] text-[#71717a] uppercase tracking-wide leading-none mb-0.5">{redName.first}</p>
            )}
            <p
              className={cn(
                'uppercase leading-[0.95] transition-colors',
                winner === 'red' ? 'text-[#e11d48]' : 'text-[#f4f4f5] group-hover/red:text-[#e11d48]/70'
              )}
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: 'clamp(1.1rem, 3.5vw, 1.35rem)' }}
            >
              {redName.last}
            </p>
            {fight.red_record && (
              <p className="text-[10px] text-[#52525b] mt-1">{fight.red_record}</p>
            )}
          </div>

          {/* Selected check */}
          {winner === 'red' && (
            <div className="absolute top-2 right-2">
              <div className="w-4 h-4 rounded-full bg-[#e11d48] flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </button>

        {/* VS divider */}
        <div className="flex flex-col items-center justify-center px-1 relative">
          <span
            className="relative z-10 text-[11px] font-black text-[#3f3f46] py-2"
            style={{ fontFamily: 'var(--font-barlow)' }}
          >
            VS
          </span>
        </div>

        {/* Blue corner */}
        <button
          onClick={() => !isLocked && !isCancelled && handleWinnerChange('blue')}
          disabled={isLocked || isCancelled}
          className={cn(
            'relative py-4 px-3 text-right transition-all group/blue',
            isLocked || isCancelled ? 'cursor-default' : 'cursor-pointer',
          )}
          style={winner === 'blue'
            ? { background: 'linear-gradient(to left, rgba(96,165,250,0.12), transparent)' }
            : undefined
          }
          onMouseEnter={(e) => {
            if (!isLocked && !isCancelled && winner !== 'blue') {
              e.currentTarget.style.background = 'linear-gradient(to left, rgba(96,165,250,0.04), transparent)'
            }
          }}
          onMouseLeave={(e) => {
            if (winner !== 'blue') e.currentTarget.style.background = ''
          }}
        >
          {/* Corner accent bar */}
          <div className={cn(
            'absolute right-0 top-0 bottom-0 w-[3px] transition-all',
            winner === 'blue' ? 'bg-blue-400' : 'bg-blue-500/20'
          )} />

          <div className="pr-2">
            {blueName.first && (
              <p className="text-[10px] text-[#71717a] uppercase tracking-wide leading-none mb-0.5">{blueName.first}</p>
            )}
            <p
              className={cn(
                'uppercase leading-[0.95] transition-colors',
                winner === 'blue' ? 'text-blue-400' : 'text-[#f4f4f5] group-hover/blue:text-blue-400/70'
              )}
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: 'clamp(1.1rem, 3.5vw, 1.35rem)' }}
            >
              {blueName.last}
            </p>
            {fight.blue_record && (
              <p className="text-[10px] text-[#52525b] mt-1">{fight.blue_record}</p>
            )}
          </div>

          {/* Selected check */}
          {winner === 'blue' && (
            <div className="absolute top-2 left-2">
              <div className="w-4 h-4 rounded-full bg-blue-400 flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
        </button>
      </div>

      {/* Sherdog links — separate row, outside fighter buttons */}
      {hasSherdog && (
        <div className="flex items-center justify-between px-5 py-1.5 border-t border-[#1a1a1a]/60">
          <div>
            {fight.red_sherdog_url ? (
              <a
                href={fight.red_sherdog_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#71717a] hover:text-[#e11d48] transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wide">Sherdog</span>
              </a>
            ) : <span />}
          </div>
          <div>
            {fight.blue_sherdog_url ? (
              <a
                href={fight.blue_sherdog_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#71717a] hover:text-blue-400 transition-colors"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide">Sherdog</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : <span />}
          </div>
        </div>
      )}

      {/* Cancelled overlay */}
      {isCancelled && (
        <div className="px-4 py-2.5 border-t border-[#1e1e1e] text-center">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Cancelled</span>
        </div>
      )}

      {/* Pick details — method + round */}
      {!isCancelled && (
        <div className="border-t border-[#1a1a1a]">
          {winner ? (
            <div className="px-3 py-3">
              {/* Method row */}
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'text-[9px] font-bold uppercase tracking-[0.15em] shrink-0 transition-colors whitespace-nowrap w-14',
                  methodFlash ? 'text-amber-400' : 'text-[#3f3f46]'
                )}>
                  {methodFlash ? 'Method ▸' : 'Method'}
                </span>
                <div className="flex gap-1 flex-1">
                  {['ko_tko', 'submission', 'decision'].map((m) => (
                    <button
                      key={m}
                      onClick={() => !isLocked && handleMethodChange(m)}
                      disabled={isLocked}
                      className={cn(
                        'h-7 px-2.5 rounded-md text-[11px] font-bold border transition-all flex-1',
                        isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                        method === m
                          ? 'bg-[#27272a] border-[#3f3f46] text-[#f4f4f5]'
                          : 'bg-transparent border-[#1e1e1e] text-[#52525b] hover:border-[#3f3f46] hover:text-[#71717a]'
                      )}
                    >
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Round row — only for KO/Sub */}
              {showRounds && (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className={cn(
                    'text-[9px] font-bold uppercase tracking-[0.15em] shrink-0 transition-colors whitespace-nowrap w-14',
                    roundFlash ? 'text-amber-400' : 'text-[#3f3f46]'
                  )}>
                    {roundFlash ? 'Round ▸' : 'Round'}
                  </span>
                  <div className="flex gap-1">
                    {Array.from({ length: fight.scheduled_rounds }, (_, i) => i + 1).map((r) => (
                      <button
                        key={r}
                        onClick={() => !isLocked && handleRoundChange(r)}
                        disabled={isLocked}
                        className={cn(
                          'w-7 h-7 rounded-md text-[11px] font-bold border transition-all',
                          isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                          round === r
                            ? 'bg-[#27272a] border-[#3f3f46] text-[#f4f4f5]'
                            : 'bg-transparent border-[#1e1e1e] text-[#52525b] hover:border-[#3f3f46] hover:text-[#71717a]'
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <span className="text-[8px] text-[#3f3f46] ml-1">+2 PTS</span>
                </div>
              )}
            </div>
          ) : !isLocked ? (
            <div className="px-3 py-3 text-center">
              <span className="text-[10px] text-[#3f3f46] uppercase tracking-[0.15em]">Tap a fighter to pick</span>
            </div>
          ) : null}

          {/* Locked pick summary */}
          {isLocked && existingPick && (
            <div className="px-3 py-2.5 flex items-center justify-center gap-2 bg-[#0e0e0e]">
              <span className="text-[10px] text-[#3f3f46] uppercase tracking-wide">Your pick</span>
              <span className="text-[10px] text-[#3f3f46]">·</span>
              <span className={cn(
                'text-[11px] font-bold uppercase',
                existingPick.pick_winner === 'red' ? 'text-[#e11d48]/70' : 'text-blue-400/70'
              )} style={{ fontFamily: 'var(--font-barlow)' }}>
                {existingPick.pick_winner === 'red' ? fight.red_name : fight.blue_name}
              </span>
              <span className="text-[10px] text-[#3f3f46]">·</span>
              <span className="text-[10px] text-[#52525b] font-semibold">
                {METHOD_LABELS[existingPick.pick_method] ?? existingPick.pick_method}
                {existingPick.pick_round ? ` R${existingPick.pick_round}` : ''}
              </span>
            </div>
          )}

          {/* No pick when locked */}
          {isLocked && !existingPick && (
            <div className="px-3 py-2.5 text-center bg-[#0e0e0e]">
              <span className="text-[10px] text-[#3f3f46] uppercase tracking-wide">No pick made</span>
            </div>
          )}
        </div>
      )}

      {/* Pick completeness indicator — bottom edge */}
      {!isLocked && !isCancelled && (
        <div className={cn(
          'h-[2px] transition-all duration-700',
          hasPick
            ? 'bg-gradient-to-r from-green-500/20 via-green-500/50 to-green-500/20'
            : isPartial
              ? 'bg-gradient-to-r from-amber-400/10 via-amber-400/35 to-amber-400/10'
              : 'bg-transparent'
        )} />
      )}
    </div>
  )
}
