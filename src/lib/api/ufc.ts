/**
 * UFC CloudFront Stats API client.
 * Base: https://d29dxerjsp82wz.cloudfront.net/api/v3
 *
 * Two endpoints:
 *   event/live/{fmid}.json  — full fight card with UFC fight IDs and results
 *   fight/live/{fightId}.json — per-fight detailed stats and result
 *
 * No authentication. No rate limiting observed. Cache-Control: max-age=4 during live events.
 * Invalid IDs return {"LiveEventDetail":{}} — handled by returning null.
 */

const UFC_BASE = 'https://d29dxerjsp82wz.cloudfront.net/api/v3'

// ─── Raw API shapes (only fields we use) ─────────────────────────────────────

interface UfcApiFighter {
  Name: { FirstName: string; LastName: string; NickName: string | null } | string
  Corner: 'Red' | 'Blue'
  Winner?: boolean // old format
  Outcome?: { OutcomeId: number | null; Outcome: string | null } // new format
}

interface UfcApiResult {
  Method: string | null
  Round?: number | null      // old format
  EndingRound?: number | null // new format
  IsComplete?: boolean       // old format
}

interface UfcApiFight {
  FightId: string | number
  Fighters: UfcApiFighter[]
  Result?: UfcApiResult
}

interface UfcApiEventResponse {
  LiveEventDetail: {
    FightCard?: UfcApiFight[]
  }
}

interface UfcApiFightResponse {
  LiveFightDetail?: {
    FightId?: string | number
    Fighters?: UfcApiFighter[]
    Result?: UfcApiResult
  }
}

// ─── Normalized types ─────────────────────────────────────────────────────────

export interface UfcLiveFight {
  fightId: string
  redName: string | null
  blueName: string | null
  redWinner: boolean
  blueWinner: boolean
  result: {
    method: string | null
    round: number | null
    isComplete: boolean
  }
}

// ─── Method mapping ────────────────────────────────────────────────────────────

export function mapUfcMethod(
  method: string | null
): 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc' | null {
  if (!method) return null
  const m = method.toLowerCase()
  if (m.includes('decision')) return 'decision'
  if (m.includes('ko') || m.includes('tko') || m.includes('knockout')) return 'ko_tko'
  if (m.includes('submission')) return 'submission'
  if (m.includes('disqualif') || m === 'dq') return 'dq'
  if (m.includes('no contest') || m === 'nc') return 'nc'
  return null
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function getFighterName(fighter: UfcApiFighter): string | null {
  if (!fighter.Name) return null
  if (typeof fighter.Name === 'string') return fighter.Name
  const { FirstName, LastName } = fighter.Name
  return [FirstName, LastName].filter(Boolean).join(' ') || null
}

function getFighterWinner(fighter: UfcApiFighter): boolean {
  // New format: Outcome.Outcome === 'Win'
  if (fighter.Outcome) return fighter.Outcome.Outcome === 'Win'
  // Old format: Winner boolean
  return fighter.Winner ?? false
}

function normalizeFight(raw: UfcApiFight): UfcLiveFight {
  const red = raw.Fighters?.find(f => f.Corner === 'Red') ?? null
  const blue = raw.Fighters?.find(f => f.Corner === 'Blue') ?? null
  const method = raw.Result?.Method ?? null
  const round = raw.Result?.EndingRound ?? raw.Result?.Round ?? null
  const isComplete = raw.Result?.IsComplete ?? (method != null)
  return {
    fightId: String(raw.FightId),
    redName: red ? getFighterName(red) : null,
    blueName: blue ? getFighterName(blue) : null,
    redWinner: red ? getFighterWinner(red) : false,
    blueWinner: blue ? getFighterWinner(blue) : false,
    result: { method, round, isComplete },
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch the full fight card for an event by UFC fmid.
 * Returns null if the fmid is invalid or the event has no fight card yet.
 */
export async function fetchUfcLiveEvent(fmid: string): Promise<UfcLiveFight[] | null> {
  try {
    const res = await fetch(`${UFC_BASE}/event/live/${fmid}.json`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`UFC event API ${res.status}`)
    const data: UfcApiEventResponse = await res.json()
    if (!data.LiveEventDetail?.FightCard?.length) return null
    return data.LiveEventDetail.FightCard.map(normalizeFight)
  } catch (err) {
    throw new Error(`fetchUfcLiveEvent(${fmid}): ${String(err)}`)
  }
}

/**
 * Fetch a single fight by UFC fight ID.
 * Returns null if the fight ID is invalid or has no data yet.
 */
export async function fetchUfcLiveFight(ufcFightId: string): Promise<UfcLiveFight | null> {
  try {
    const res = await fetch(`${UFC_BASE}/fight/live/${ufcFightId}.json`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) throw new Error(`UFC fight API ${res.status}`)
    const data: UfcApiFightResponse = await res.json()
    if (!data.LiveFightDetail?.FightId) return null
    return normalizeFight({
      FightId: data.LiveFightDetail.FightId,
      Fighters: data.LiveFightDetail.Fighters ?? [],
      Result: data.LiveFightDetail.Result,
    })
  } catch (err) {
    throw new Error(`fetchUfcLiveFight(${ufcFightId}): ${String(err)}`)
  }
}

/**
 * Extract the winner for our DB schema from a normalized UFC fight.
 * Returns 'red', 'blue', 'draw', or 'nc'.
 */
export function getUfcWinner(
  fight: UfcLiveFight
): 'red' | 'blue' | 'draw' | 'nc' {
  const method = mapUfcMethod(fight.result.method)
  if (method === 'nc') return 'nc'
  if (fight.redWinner) return 'red'
  if (fight.blueWinner) return 'blue'
  return 'draw'
}
