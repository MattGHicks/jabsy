import type {
  EspnScoreboardResponse,
  EspnEvent,
  EspnCompetition,
  EspnCalendarEntry,
  ValidationWarning,
  ValidatedResult,
} from './types'
import { recordSuccess, recordFailure } from './espn-health'
import { parseEspnMethodLine } from './results'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc'

/**
 * Fetch the UFC scoreboard. Returns current/recent events with full fight data.
 * Optionally filter by date range (YYYYMMDD-YYYYMMDD).
 * Records health status on success/failure.
 */
export async function fetchScoreboard(dateRange?: string): Promise<EspnScoreboardResponse> {
  const url = dateRange
    ? `${ESPN_BASE}/scoreboard?dates=${dateRange}`
    : `${ESPN_BASE}/scoreboard`

  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) {
      const error = `ESPN API error: ${res.status} ${res.statusText}`
      await recordFailure('scoreboard', error).catch(() => {})
      throw new Error(error)
    }
    await recordSuccess('scoreboard').catch(() => {})
    return res.json()
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('ESPN API error:')) throw err
    await recordFailure('scoreboard', String(err)).catch(() => {})
    throw err
  }
}

/**
 * Get the full calendar of upcoming UFC events for the year.
 * Returns validated result with warnings if calendar structure is missing.
 */
export async function fetchCalendar(): Promise<ValidatedResult<EspnCalendarEntry[]>> {
  const warnings: ValidationWarning[] = []
  const data = await fetchScoreboard()

  if (!data.leagues || data.leagues.length === 0) {
    warnings.push({
      type: 'missing_calendar',
      message: 'ESPN response has no leagues array',
      context: { keys: Object.keys(data) },
    })
    return { data: [], warnings }
  }

  const calendar = data.leagues[0]?.calendar
  if (!calendar || calendar.length === 0) {
    warnings.push({
      type: 'missing_calendar',
      message: 'ESPN leagues[0] has no calendar entries',
    })
    return { data: [], warnings }
  }

  return { data: calendar, warnings }
}

/**
 * Fetch a specific event by date range that includes it.
 * ESPN scoreboard with date filter returns events matching that date.
 */
export async function fetchEventByDate(date: string): Promise<EspnEvent | null> {
  // Use a 3-day window to catch events
  const d = new Date(date)
  const start = new Date(d.getTime() - 86400000) // day before
  const end = new Date(d.getTime() + 86400000) // day after
  const startStr = formatDate(start)
  const endStr = formatDate(end)

  const data = await fetchScoreboard(`${startStr}-${endStr}`)
  return data.events?.[0] ?? null
}

/**
 * Fetch event with full fight card using the ESPN event ID.
 * We search the calendar for the event's date, then fetch by date range.
 * Records health status on success/failure.
 */
export async function fetchEventById(espnEventId: string): Promise<EspnEvent | null> {
  try {
    // First get calendar to find the event's date
    const calResult = await fetchCalendar()
    const calendar = calResult.data
    const calEntry = calendar.find(c => {
      const ref = c.event?.$ref ?? ''
      return ref.includes(`events/${espnEventId}`)
    })

    if (!calEntry) {
      await recordFailure('event', `Event ${espnEventId} not found in calendar`).catch(() => {})
      return null
    }

    // Fetch by date range around the event
    const event = await fetchEventByDate(calEntry.startDate)
    if (event) {
      await recordSuccess('event').catch(() => {})
    } else {
      await recordFailure('event', `Event ${espnEventId} not found in date range`).catch(() => {})
    }
    return event
  } catch (err) {
    await recordFailure('event', String(err)).catch(() => {})
    throw err
  }
}

/**
 * Parse ESPN competitor order into red/blue corners.
 * Returns ValidatedResult with null data if competitors are missing/insufficient.
 */
export function getCorners(competition: EspnCompetition): ValidatedResult<{
  red: { name: string; record: string | null; espnId: string; winner: boolean }
  blue: { name: string; record: string | null; espnId: string; winner: boolean }
} | null> {
  const warnings: ValidationWarning[] = []

  if (!competition.competitors || competition.competitors.length === 0) {
    warnings.push({
      type: 'missing_competitors',
      message: `Competition ${competition.id} has no competitors`,
      context: { competition_id: competition.id },
    })
    return { data: null, warnings }
  }

  if (competition.competitors.length < 2) {
    warnings.push({
      type: 'insufficient_competitors',
      message: `Competition ${competition.id} has only ${competition.competitors.length} competitor(s)`,
      context: { competition_id: competition.id, count: competition.competitors.length },
    })
    return { data: null, warnings }
  }

  if (competition.competitors.length > 2) {
    warnings.push({
      type: 'missing_competitors',
      message: `Competition ${competition.id} has ${competition.competitors.length} competitors (expected 2)`,
      context: { competition_id: competition.id, count: competition.competitors.length },
    })
  }

  const sorted = [...competition.competitors].sort((a, b) => a.order - b.order)
  const red = sorted[0]
  const blue = sorted[1]

  return {
    data: {
      red: {
        name: red.athlete.fullName,
        record: red.records?.[0]?.summary ?? null,
        espnId: red.id,
        winner: red.winner ?? false,
      },
      blue: {
        name: blue.athlete.fullName,
        record: blue.records?.[0]?.summary ?? null,
        espnId: blue.id,
        winner: blue.winner ?? false,
      },
    },
    warnings,
  }
}

/**
 * Extract the fight result method from ESPN's "Unofficial Winner <method>"
 * detail line. Everything else in `details` is play-by-play ("Submission
 * Attempt", "Knockdown", "Clinch") and must not be read as a result — doing so,
 * and guessing KO/TKO when the line was missing, is how fights got scored wrong.
 * A completed bout with no result line yet returns null plus a warning; callers
 * wait for the next poll or for the UFC feed instead of writing a guess.
 */
export function getResultMethod(competition: EspnCompetition): ValidatedResult<'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc' | null> {
  const warnings: ValidationWarning[] = []
  const details = competition.details ?? []

  for (const detail of details) {
    const method = parseEspnMethodLine(detail.type?.text ?? '')
    if (method) return { data: method, warnings }
  }

  if (competition.status.type.completed) {
    warnings.push({
      type: 'missing_method',
      message: `Competition ${competition.id} completed but ESPN has no result line yet`,
      context: {
        competition_id: competition.id,
        details_texts: details.slice(0, 10).map(d => d.type?.text),
        period: competition.status.period,
        clock: competition.status.displayClock,
      },
    })
  }

  return { data: null, warnings }
}

/**
 * Map ESPN status to our fight status enum.
 */
export function mapFightStatus(espnStatus: EspnCompetition['status']): 'scheduled' | 'live' | 'final' | 'cancelled' | 'no_contest' {
  switch (espnStatus.type.state) {
    case 'pre': return 'scheduled'
    case 'in': return 'live'
    case 'post': return espnStatus.type.completed ? 'final' : 'final'
    default: return 'scheduled'
  }
}

/**
 * Extract the ESPN event ID from a calendar $ref URL.
 */
export function extractEventId(calEntry: EspnCalendarEntry): string {
  const ref = calEntry.event?.$ref ?? ''
  const match = ref.match(/events\/(\d+)/)
  return match?.[1] ?? ''
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0].replace(/-/g, '')
}
