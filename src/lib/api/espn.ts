import type {
  EspnScoreboardResponse,
  EspnEvent,
  EspnCompetition,
  EspnCalendarEntry,
} from './types'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc'

/**
 * Fetch the UFC scoreboard. Returns current/recent events with full fight data.
 * Optionally filter by date range (YYYYMMDD-YYYYMMDD).
 */
export async function fetchScoreboard(dateRange?: string): Promise<EspnScoreboardResponse> {
  const url = dateRange
    ? `${ESPN_BASE}/scoreboard?dates=${dateRange}`
    : `${ESPN_BASE}/scoreboard`

  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`ESPN API error: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Get the full calendar of upcoming UFC events for the year.
 * Returns event names, dates, and ESPN event IDs.
 */
export async function fetchCalendar(): Promise<EspnCalendarEntry[]> {
  const data = await fetchScoreboard()
  return data.leagues?.[0]?.calendar ?? []
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
 */
export async function fetchEventById(espnEventId: string): Promise<EspnEvent | null> {
  // First get calendar to find the event's date
  const calendar = await fetchCalendar()
  const calEntry = calendar.find(c => {
    const ref = c.event?.$ref ?? ''
    return ref.includes(`events/${espnEventId}`)
  })

  if (!calEntry) return null

  // Fetch by date range around the event
  return fetchEventByDate(calEntry.startDate)
}

/**
 * Parse ESPN competitor order into red/blue corners.
 * ESPN convention: order=1 is typically the first listed (red corner),
 * order=2 is second listed (blue corner).
 * We map: order=1 → red, order=2 → blue
 */
export function getCorners(competition: EspnCompetition) {
  const sorted = [...competition.competitors].sort((a, b) => a.order - b.order)
  const red = sorted[0] // order=1
  const blue = sorted[1] // order=2

  return {
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
  }
}

/**
 * Extract fight result method from ESPN details array.
 * Returns null if fight hasn't finished.
 */
export function getResultMethod(competition: EspnCompetition): 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc' | null {
  const details = competition.details ?? []

  for (const detail of details) {
    const text = detail.type.text
    if (text === 'Unofficial Winner Decision') return 'decision'
    if (text === 'Unofficial Winner Kotko') return 'ko_tko'
    if (text === 'Unofficial Winner Submission') return 'submission'
  }

  // If status is final but no method found, infer from round/clock
  if (competition.status.type.completed) {
    const period = competition.status.period
    const rounds = competition.format.regulation.periods
    const clock = competition.status.displayClock

    // Full rounds completed with full clock = decision
    if (period === rounds && clock === '5:00') return 'decision'

    // Otherwise it's likely a finish but we couldn't determine method
    // Default to ko_tko for non-decision finishes (most common)
    return 'ko_tko'
  }

  return null
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
