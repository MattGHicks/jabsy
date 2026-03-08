import type { EspnEvent, EspnCompetition, MappedEvent, MappedFight } from './types'
import { getCorners, getResultMethod, mapFightStatus } from './espn'
import type { Database } from '@/types/database'

type EventInsert = Database['public']['Tables']['events']['Insert']
type FightInsert = Database['public']['Tables']['fights']['Insert']

/**
 * Map an ESPN event + its competitions to our MappedEvent format.
 */
export function mapEspnEvent(event: EspnEvent, importedEventIds: Set<string>): MappedEvent {
  const venue = event.competitions[0]?.venue
  const venueStr = venue
    ? `${venue.fullName}${venue.address?.city ? `, ${venue.address.city}` : ''}${venue.address?.state ? `, ${venue.address.state}` : ''}`
    : null

  const fights = event.competitions.map((comp, index) =>
    mapEspnFight(comp, event.competitions.length - index)
  )

  // ESPN lists fights in reverse bout order (main event first)
  fights.reverse()

  return {
    espnEventId: event.id,
    name: event.name,
    shortName: event.shortName,
    startTime: event.date,
    venue: venueStr,
    fightCount: event.competitions.length,
    fights,
    alreadyImported: importedEventIds.has(event.id),
  }
}

/**
 * Map an ESPN competition to our MappedFight format.
 */
export function mapEspnFight(comp: EspnCompetition, boutOrder: number): MappedFight {
  const corners = getCorners(comp)
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
    const method = getResultMethod(comp)
    if (method) {
      let winner: 'red' | 'blue' | 'draw' | 'nc' = 'draw'
      if (corners.red.winner) winner = 'red'
      else if (corners.blue.winner) winner = 'blue'

      // For KO/TKO and submissions, the round is the period the fight ended
      // For decisions, round is null (no specific round)
      const round = (method === 'ko_tko' || method === 'submission')
        ? comp.status.period
        : null

      fight.result = { winner, method, round }
    }
  }

  return fight
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
