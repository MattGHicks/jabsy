import type { EspnEvent, EspnCompetition, MappedEvent, MappedFight, ValidationWarning, ValidatedResult } from './types'
import { getCorners, getResultMethod, mapFightStatus } from './espn'
import type { Database } from '@/types/database'

type EventInsert = Database['public']['Tables']['events']['Insert']
type FightInsert = Database['public']['Tables']['fights']['Insert']

/**
 * Map an ESPN event + its competitions to our MappedEvent format.
 * Returns ValidatedResult with collected warnings from all fight mappings.
 */
export function mapEspnEvent(event: EspnEvent, importedEventIds: Set<string>): ValidatedResult<MappedEvent> {
  const allWarnings: ValidationWarning[] = []

  const venue = event.competitions[0]?.venue
  const venueStr = venue
    ? `${venue.fullName}${venue.address?.city ? `, ${venue.address.city}` : ''}${venue.address?.state ? `, ${venue.address.state}` : ''}`
    : null

  const fights: MappedFight[] = []
  for (let i = 0; i < event.competitions.length; i++) {
    const comp = event.competitions[i]
    const boutOrder = event.competitions.length - i
    const result = mapEspnFight(comp, boutOrder)
    allWarnings.push(...result.warnings)
    if (result.data) {
      fights.push(result.data)
    }
  }

  // ESPN lists fights in reverse bout order (main event first)
  fights.reverse()

  return {
    data: {
      espnEventId: event.id,
      name: event.name,
      shortName: event.shortName,
      startTime: event.date,
      venue: venueStr,
      fightCount: event.competitions.length,
      fights,
      alreadyImported: importedEventIds.has(event.id),
    },
    warnings: allWarnings,
  }
}

/**
 * Map an ESPN competition to our MappedFight format.
 * Returns ValidatedResult with null data if corners can't be extracted.
 */
export function mapEspnFight(comp: EspnCompetition, boutOrder: number): ValidatedResult<MappedFight | null> {
  const allWarnings: ValidationWarning[] = []

  const cornersResult = getCorners(comp)
  allWarnings.push(...cornersResult.warnings)

  if (!cornersResult.data) {
    return { data: null, warnings: allWarnings }
  }

  const corners = cornersResult.data
  const status = mapFightStatus(comp.status)
  const scheduledRounds = comp.format?.regulation?.periods ?? 3
  const isMainEvent = scheduledRounds === 5

  const fight: MappedFight = {
    espnCompetitionId: comp.id,
    redName: corners.red.name,
    redRecord: corners.red.record,
    blueName: corners.blue.name,
    blueRecord: corners.blue.record,
    weightClass: comp.type?.abbreviation || null,
    scheduledRounds,
    isMainEvent,
    boutOrder,
    status,
  }

  // Add result if fight is finished
  if (status === 'final') {
    const methodResult = getResultMethod(comp)
    allWarnings.push(...methodResult.warnings)

    if (methodResult.data) {
      let winner: 'red' | 'blue' | 'draw' | 'nc' = 'draw'
      if (corners.red.winner) winner = 'red'
      else if (corners.blue.winner) winner = 'blue'

      // For KO/TKO and submissions, the round is the period the fight ended
      // For decisions, round is null (no specific round)
      const round = (methodResult.data === 'ko_tko' || methodResult.data === 'submission')
        ? comp.status.period
        : null

      fight.result = { winner, method: methodResult.data, round }
    }
  }

  return { data: fight, warnings: allWarnings }
}

/**
 * Convert a MappedEvent to a DB event insert row.
 */
export function toEventInsert(mapped: MappedEvent, userId: string): EventInsert {
  return {
    name: mapped.name,
    start_time: mapped.startTime,
    lock_time: mapped.startTime,
    venue: mapped.venue,
    status: 'upcoming',
    created_by: userId,
    espn_event_id: mapped.espnEventId,
    auto_sync_enabled: true,
    last_synced_at: new Date().toISOString(),
  }
}

/**
 * Convert a MappedFight to a DB fight insert row.
 */
export function toFightInsert(mapped: MappedFight, eventId: string): FightInsert {
  return {
    event_id: eventId,
    red_name: mapped.redName,
    red_record: mapped.redRecord,
    blue_name: mapped.blueName,
    blue_record: mapped.blueRecord,
    weight_class: mapped.weightClass,
    scheduled_rounds: mapped.scheduledRounds,
    is_main_event: mapped.isMainEvent,
    bout_order: mapped.boutOrder,
    espn_competition_id: mapped.espnCompetitionId,
    sync_status: 'synced' as const,
    last_synced_at: new Date().toISOString(),
  }
}
