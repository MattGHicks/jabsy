// ESPN API response types

export interface EspnScoreboardResponse {
  leagues: EspnLeague[]
  events: EspnEvent[]
  season: { type: number; year: number }
  day: { date: string }
}

export interface EspnLeague {
  id: string
  name: string
  calendar: EspnCalendarEntry[]
}

export interface EspnCalendarEntry {
  label: string
  startDate: string
  endDate: string
  event: { $ref: string }
}

export interface EspnEvent {
  id: string
  uid: string
  date: string
  name: string
  shortName: string
  competitions: EspnCompetition[]
}

export interface EspnCompetition {
  id: string
  uid: string
  date: string
  type: {
    id: string
    abbreviation: string // weight class: "Lightweight", "Heavyweight", etc.
  }
  venue?: {
    id: string
    fullName: string
    address?: {
      city: string
      state: string
      country: string
    }
  }
  competitors: EspnCompetitor[]
  status: EspnStatus
  format: {
    regulation: {
      periods: number // 3 or 5 rounds
    }
  }
  details?: EspnDetail[]
  broadcasts?: { market: string; names: string[] }[]
}

export interface EspnCompetitor {
  id: string
  uid: string
  type: string
  order: number // 1 or 2
  winner?: boolean
  athlete: {
    fullName: string
    displayName: string
    shortName: string
    flag?: {
      href: string
      alt: string
    }
  }
  records?: {
    name: string
    abbreviation: string
    type: string
    summary: string // e.g. "27-1-0"
  }[]
  statistics?: unknown[]
}

export interface EspnStatus {
  clock: number
  displayClock: string
  period: number // round number
  type: {
    id: string
    name: string // STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL
    state: string // "pre", "in", "post"
    completed: boolean
    description: string
    detail: string
    shortDetail: string
  }
}

export interface EspnDetail {
  id: string
  type: {
    id: string
    text: string
    // Known types:
    // "Unofficial Winner Decision" (id=22) = Decision
    // "Unofficial Winner Kotko" (id=21) = KO/TKO
    // "Unofficial Winner Submission" (id=20) = Submission
    // "Fight Over" (id=19)
    // "Results" (id=23)
    // "Round Start" (id=5)
    // "Round End" (id=18)
    // "Knockdown" (id=17)
    // "Submission Attempt" (id=16)
    // "Takedown" (id=13)
  }
}

// Validation types

export interface ValidationWarning {
  type:
    | 'missing_competitors'
    | 'insufficient_competitors'
    | 'missing_method'
    | 'unknown_status'
    | 'missing_calendar'
    | 'missing_event_ref'
    | 'fetch_error'
    | 'malformed_response'
    | 'missing_details'
  message: string
  context?: Record<string, unknown>
}

export interface ValidatedResult<T> {
  data: T
  warnings: ValidationWarning[]
}

// Mapped types for our app

export interface MappedEvent {
  espnEventId: string
  name: string
  shortName: string
  startTime: string // ISO UTC
  venue: string | null
  fightCount: number
  fights: MappedFight[]
  alreadyImported: boolean
}

export interface MappedFight {
  espnCompetitionId: string
  redName: string
  redRecord: string | null
  blueName: string
  blueRecord: string | null
  weightClass: string | null
  scheduledRounds: number
  isMainEvent: boolean
  boutOrder: number
  status: 'scheduled' | 'live' | 'final' | 'cancelled' | 'no_contest'
  result?: {
    winner: 'red' | 'blue' | 'draw' | 'nc'
    method: 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc'
    round: number | null
  }
}
