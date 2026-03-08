export type PickMethod = 'decision' | 'ko_tko' | 'submission'
export type PickWinner = 'red' | 'blue'
export type ResultMethod = 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc'
export type ResultWinner = 'red' | 'blue' | 'draw' | 'nc'

export interface PickResult {
  points: number
  correctWinner: boolean
  correctMethod: boolean
  correctRound: boolean
}

/**
 * Calculate 5-3-2 scoring for a single pick against a fight result.
 * - 5 pts: correct winner
 * - 3 pts: correct method (only if winner correct)
 * - 2 pts: correct round (only if winner+method correct AND method is KO/TKO or Submission)
 */
export function calculatePoints(
  pick: {
    pick_winner: PickWinner
    pick_method: PickMethod
    pick_round: number | null
  },
  result: {
    result_winner: ResultWinner | null
    result_method: ResultMethod | null
    result_round: number | null
  }
): PickResult {
  // No result yet, or draw/no contest
  if (!result.result_winner || result.result_winner === 'draw' || result.result_winner === 'nc') {
    return { points: 0, correctWinner: false, correctMethod: false, correctRound: false }
  }

  const correctWinner = pick.pick_winner === result.result_winner
  if (!correctWinner) {
    return { points: 0, correctWinner: false, correctMethod: false, correctRound: false }
  }

  let points = 5
  const correctMethod = pick.pick_method === result.result_method
  if (!correctMethod) {
    return { points, correctWinner: true, correctMethod: false, correctRound: false }
  }

  points += 3

  // Round bonus only for KO/TKO or Submission (not Decision)
  const roundEligible = result.result_method !== 'decision' && result.result_method !== 'dq' && result.result_method !== 'nc'
  const correctRound = roundEligible && pick.pick_round !== null && pick.pick_round === result.result_round

  if (correctRound) {
    points += 2
  }

  return { points, correctWinner: true, correctMethod: true, correctRound }
}

export function isRoundPickEligible(method: PickMethod | null): boolean {
  return method === 'ko_tko' || method === 'submission'
}
