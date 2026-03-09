/**
 * Weighted accuracy calculation for Jabsy picks.
 *
 * Accuracy = points earned ÷ max possible points × 100
 *
 * Max possible per fight depends on the actual result:
 *  - Decision:          8 pts (5 winner + 3 method)
 *  - KO/TKO or Sub:   10 pts (5 winner + 3 method + 2 round)
 *  - Draw / NC:         excluded from calculation
 */

/** Max achievable points for a single fight given its result method. */
export function calcMaxPoints(resultMethod: string): number {
  return resultMethod === 'ko_tko' || resultMethod === 'submission' ? 10 : 8
}

type ScoredPick = {
  points_earned: number | null
  result_method: string
  result_winner?: string | null
}

/**
 * Calculate weighted accuracy across a set of scored picks.
 * Automatically excludes draws and no-contests.
 * Returns a rounded percentage (0-100) or null if no scored picks exist.
 */
export function calcWeightedAccuracy(picks: ScoredPick[]): number | null {
  const scored = picks.filter(
    (p) =>
      p.points_earned !== null &&
      p.result_winner !== 'draw' &&
      p.result_winner !== 'nc'
  )
  if (scored.length === 0) return null

  const earned = scored.reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
  const maxPossible = scored.reduce((sum, p) => sum + calcMaxPoints(p.result_method), 0)

  return maxPossible > 0 ? Math.round((earned / maxPossible) * 100) : null
}
