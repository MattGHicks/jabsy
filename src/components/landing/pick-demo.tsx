'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getLastName } from '@/lib/utils'

type Corner = 'red' | 'blue'
type Method = 'ko_tko' | 'submission' | 'decision'

interface Fighter {
  name: string
  record: string | null
}

interface PickDemoProps {
  red: Fighter
  blue: Fighter
  weightClass: string | null
  rounds: number
}

const METHODS: { id: Method; label: string }[] = [
  { id: 'ko_tko', label: 'KO / TKO' },
  { id: 'submission', label: 'Submission' },
  { id: 'decision', label: 'Decision' },
]

const firstNames = (full: string) => {
  const last = getLastName(full)
  return full.slice(0, full.length - last.length).trim()
}

/**
 * The landing hero: a working pick slip for the real main event. Nothing is
 * saved — it only shows a visitor what a pick is and how it scores.
 */
export function PickDemo({ red, blue, weightClass, rounds }: PickDemoProps) {
  const [winner, setWinner] = useState<Corner | null>(null)
  const [method, setMethod] = useState<Method | null>(null)
  const [round, setRound] = useState<number | null>(null)

  const redLast = getLastName(red.name).toUpperCase()
  const blueLast = getLastName(blue.name).toUpperCase()

  // Both names share one size, set by the longest single word so neither wraps
  // mid-word. Each half is ~42cqw of usable width; condensed caps run ~0.5em.
  const longestWord = Math.max(...`${redLast} ${blueLast}`.split(/\s+/).map(w => w.length))
  const nameSize = `clamp(1.75rem, ${Math.min(15, 76 / longestWord).toFixed(1)}cqw, 8.5rem)`

  const roundCounts = method !== null && method !== 'decision'
  const points = (winner ? 5 : 0) + (winner && method ? 3 : 0) + (winner && roundCounts && round ? 2 : 0)
  const picked = winner ? getLastName(winner === 'red' ? red.name : blue.name) : null

  function pickMethod(m: Method) {
    setMethod(m)
    if (m === 'decision') setRound(null)
  }

  const callText = !winner
    ? 'Pick a corner to start.'
    : !method
      ? `${picked} to win. How does it end?`
      : method === 'decision'
        ? `${picked} by decision.`
        : !round
          ? `${picked} by ${method === 'ko_tko' ? 'knockout' : 'submission'}. Which round?`
          : `${picked} by ${method === 'ko_tko' ? 'knockout' : 'submission'} in round ${round}.`

  return (
    <div data-winner={winner ?? undefined} className="pick-demo rounded-2xl border border-border bg-surface-1 overflow-hidden">
      {/* Corners */}
      <div className="corners relative grid grid-cols-2" role="group" aria-label="Pick the winner">
        {([
          { corner: 'red' as const, fighter: red, last: redLast },
          { corner: 'blue' as const, fighter: blue, last: blueLast },
        ]).map(({ corner, fighter, last }) => {
          const selected = winner === corner
          const dimmed = winner !== null && !selected
          return (
            <button
              key={corner}
              type="button"
              aria-pressed={selected}
              onClick={() => setWinner(corner)}
              className={`corner corner-${corner} group relative flex flex-col justify-end min-h-[11rem] sm:min-h-[15rem] px-4 sm:px-8 pt-10 pb-5 sm:pb-7 cursor-pointer ${
                corner === 'blue' ? 'items-end text-right pl-8 sm:pl-12' : 'items-start text-left pr-8 sm:pr-12'
              } ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
            >
              <span className={`corner-tag absolute top-4 sm:top-5 text-xs font-medium ${corner === 'blue' ? 'right-4 sm:right-8' : 'left-4 sm:left-8'}`}>
                {corner === 'red' ? 'Red corner' : 'Blue corner'}
              </span>
              <span className="corner-first text-sm sm:text-base">{firstNames(fighter.name) || ' '}</span>
              <span className="font-display uppercase leading-[0.86]" style={{ fontSize: nameSize, fontWeight: 900 }}>
                {last}
              </span>
              {fighter.record && (
                <span className="corner-record mt-2 text-xs sm:text-sm tabular-nums">{fighter.record}</span>
              )}
            </button>
          )
        })}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-surface-0 border border-border font-display text-sm sm:text-base text-text-secondary"
          style={{ fontWeight: 800 }}
        >
          VS
        </span>
      </div>

      {/* Bout facts */}
      <p className="px-4 sm:px-8 py-2.5 border-y border-border text-xs sm:text-sm text-text-muted text-center">
        {[weightClass, `${rounds} rounds`].filter(Boolean).join(', ')}
      </p>

      {/* Method + round */}
      <div className="grid gap-5 sm:gap-8 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] px-4 sm:px-8 py-5 sm:py-6">
        <div role="group" aria-label="Method of victory">
          <p className="text-sm text-text-secondary mb-2">Method</p>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(m => (
              <button
                key={m.id}
                type="button"
                disabled={!winner}
                aria-pressed={method === m.id}
                onClick={() => pickMethod(m.id)}
                className={`chip h-11 rounded-lg text-sm font-medium ${method === m.id ? 'is-on' : ''}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div role="group" aria-label="Round">
          <p className="text-sm text-text-secondary mb-2">
            Round{method === 'decision' && <span className="text-text-muted"> (goes the distance)</span>}
          </p>
          <div className="flex gap-2">
            {Array.from({ length: rounds }, (_, i) => i + 1).map(r => (
              <button
                key={r}
                type="button"
                disabled={!roundCounts}
                aria-pressed={round === r}
                aria-label={`Round ${r}`}
                onClick={() => setRound(r)}
                className={`chip flex-1 h-11 rounded-lg text-sm font-medium tabular-nums ${round === r ? 'is-on' : ''}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tally */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-4 sm:px-8 py-4 sm:py-5 border-t border-border bg-surface-0/60">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div
            className={`font-display leading-none tabular-nums transition-colors duration-200 ${points ? 'text-text-primary' : 'text-text-muted'}`}
            style={{ fontSize: '3.25rem', fontWeight: 900 }}
            aria-hidden="true"
          >
            {points}
          </div>
          <div className="min-w-0">
            <p className="text-sm sm:text-base text-text-primary" aria-live="polite">
              {callText}
              <span className="sr-only"> Worth {points} points if you are right.</span>
            </p>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
              <span className={winner ? 'text-text-secondary' : ''}>5 winner</span>
              {' + '}
              <span className={winner && method ? 'text-text-secondary' : ''}>3 method</span>
              {' + '}
              <span className={winner && roundCounts && round ? 'text-text-secondary' : method === 'decision' ? 'line-through' : ''}>2 round</span>
              {' if you’re right'}
            </p>
          </div>
        </div>
        <Link
          href="/signup"
          className="btn-primary inline-flex items-center justify-center h-12 px-6 rounded-lg text-base font-semibold shrink-0"
        >
          {winner ? 'Make this pick for real' : 'Create a free account'}
        </Link>
      </div>
    </div>
  )
}
