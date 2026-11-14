/**
 * Fight result resolution — turns raw ESPN / UFC feed data into a result we
 * are willing to score, and compares results.
 *
 * Two rules, both learned from fights that were scored wrong:
 *
 *  1. ESPN is only trusted when it states the result outright: a winner flag
 *     plus an "Unofficial Winner <method>" line. Its details array is mostly
 *     play-by-play ("Submission Attempt", "Knockdown", "Clinch"), and it often
 *     marks a bout final before the result line appears. A missing line means
 *     "not known yet" — never a guess.
 *  2. The UFC stats feed is the official record (per-fighter Outcome, Method,
 *     EndingRound). When it has a result, it wins over ESPN.
 *
 * Kept free of runtime imports so it can be exercised outside Next.js.
 */
import type { EspnCompetition } from './types'
import type { UfcLiveFight } from './ufc'

export type ResultWinner = 'red' | 'blue' | 'draw' | 'nc'
export type ResultMethod = 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc'
export type ResultSource = 'ufc_api' | 'espn'

export interface FightResult {
  winner: ResultWinner
  method: ResultMethod
  round: number | null
}

/** What a fights row holds — any column may still be null. */
export interface StoredResult {
  winner: string | null
  method: string | null
  round: number | null
}

export function isFinish(method: string | null): boolean {
  return method === 'ko_tko' || method === 'submission'
}

/** Map a UFC feed method string ("KO/TKO", "Decision - Split", …) to ours. */
export function mapUfcMethod(method: string | null): ResultMethod | null {
  if (!method) return null
  const m = method.toLowerCase()
  if (m.includes('decision')) return 'decision'
  if (m.includes('submission')) return 'submission'
  if (m.includes('ko') || m.includes('knockout')) return 'ko_tko'
  if (m.includes('disqualif') || m === 'dq') return 'dq'
  if (m.includes('no contest') || m === 'nc' || m.includes('overturned')) return 'nc'
  return null
}

/**
 * The method named on an ESPN result line ("Unofficial Winner Kotko"), or null
 * for anything else — play-by-play entries included.
 */
export function parseEspnMethodLine(text: string): ResultMethod | null {
  const match = text.trim().match(/^unofficial\s+winner\s+(.+)$/i)
  if (!match) return null
  const kind = match[1].toLowerCase()
  if (kind.includes('decision')) return 'decision'
  if (kind.includes('submission')) return 'submission'
  if (kind.includes('ko') || kind.includes('knockout')) return 'ko_tko'
  if (kind.includes('disqualif') || /\bdq\b/.test(kind)) return 'dq'
  return null
}

/** ESPN's result for a completed bout, only if stated explicitly. */
export function espnResult(comp: EspnCompetition): FightResult | null {
  if (!comp.status?.type?.completed) return null
  const texts = (comp.details ?? []).map(d => (d.type?.text ?? '').trim())

  if (texts.some(t => /^(unofficial\s+)?no\s+contest\b/i.test(t))) {
    return { winner: 'nc', method: 'nc', round: null }
  }
  if (texts.some(t => /^(unofficial\s+)?draw\b/i.test(t))) {
    return { winner: 'draw', method: 'decision', round: null }
  }

  const [red, blue] = [...(comp.competitors ?? [])].sort((a, b) => a.order - b.order)
  if (!red || !blue) return null
  const winner = red.winner && !blue.winner ? 'red'
    : blue.winner && !red.winner ? 'blue'
    : null
  if (!winner) return null

  const method = texts.map(parseEspnMethodLine).find(m => m !== null) ?? null
  if (!method) return null

  const round = isFinish(method) ? (comp.status.period ?? null) : null
  if (isFinish(method) && !round) return null
  return { winner, method, round }
}

/** The UFC feed's official result for a bout, or null if it isn't complete. */
export function ufcResult(fight: UfcLiveFight): FightResult | null {
  if (!fight.result.isComplete) return null

  const outcomes = [fight.redOutcome, fight.blueOutcome].map(o => (o ?? '').toLowerCase())
  const method = mapUfcMethod(fight.result.method)

  if (method === 'nc' || outcomes.some(o => o.includes('no contest'))) {
    return { winner: 'nc', method: 'nc', round: null }
  }
  if (outcomes.every(o => o === 'draw')) {
    return { winner: 'draw', method: 'decision', round: null }
  }

  const winner = fight.redWinner && !fight.blueWinner ? 'red'
    : fight.blueWinner && !fight.redWinner ? 'blue'
    : null
  // A winner with a method we don't recognise ("Could Not Continue", "Other")
  // is left for a human rather than scored under a guessed method.
  if (!winner || !method) return null

  const round = isFinish(method) ? (fight.result.round ?? null) : null
  if (isFinish(method) && !round) return null
  return { winner, method, round }
}

/**
 * Whether a stored result scores identically to `official`. Draws and no
 * contests score 0 whatever the method, and the round only matters for finishes.
 */
export function sameResult(stored: StoredResult, official: FightResult): boolean {
  if (stored.winner !== official.winner) return false
  if (official.winner === 'draw' || official.winner === 'nc') return true
  if (stored.method !== official.method) return false
  return !isFinish(official.method) || stored.round === official.round
}

/**
 * Pick the result to score from what each feed reported. UFC is the official
 * record, so it wins a disagreement; `conflict` flags it for the log.
 */
export function resolveResult(
  ufc: FightResult | null,
  espn: FightResult | null,
): { result: FightResult; source: ResultSource; conflict: boolean } | null {
  if (ufc) return { result: ufc, source: 'ufc_api', conflict: !!espn && !sameResult(espn, ufc) }
  if (espn) return { result: espn, source: 'espn', conflict: false }
  return null
}

export function describeResult(r: StoredResult | FightResult | null): string {
  if (!r || !r.winner) return 'none'
  return `${r.winner}/${r.method ?? '?'}${isFinish(r.method) && r.round ? ` R${r.round}` : ''}`
}

/**
 * Orient a UFC feed bout to our red/blue corners, swapping it if the feed lists
 * the fighters the other way round, so a UFC "red" win can never be scored for
 * the wrong fighter. Null when the names don't match either way.
 */
export function alignUfcFight(fight: UfcLiveFight, redName: string, blueName: string): UfcLiveFight | null {
  const fits = (feedName: string | null, ourName: string) => {
    if (!feedName) return false
    const a = normalizeName(feedName)
    const b = normalizeName(ourName)
    return a.includes(lastName(b)) || b.includes(lastName(a))
  }
  if (fits(fight.redName, redName) && fits(fight.blueName, blueName)) return fight
  if (fits(fight.redName, blueName) && fits(fight.blueName, redName)) {
    return {
      ...fight,
      redName: fight.blueName, blueName: fight.redName,
      redWinner: fight.blueWinner, blueWinner: fight.redWinner,
      redOutcome: fight.blueOutcome, blueOutcome: fight.redOutcome,
    }
  }
  return null
}

function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+jr\.?$/, '').trim()
}

function lastName(name: string): string {
  return normalizeName(name).split(/\s+/).pop() ?? ''
}
