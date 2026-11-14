import type { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/types/database'
import { calculatePoints, type PickMethod, type PickWinner, type ResultMethod, type ResultWinner } from '@/lib/scoring'
import { fetchScoreboard } from './espn'
import { fetchUfcLiveEvent, type UfcLiveFight } from './ufc'
import { syncUfcIds } from './ufc-ids'
import type { EspnCompetition } from './types'
import {
  alignUfcFight, describeResult, espnResult, resolveResult, sameResult, ufcResult,
  type FightResult,
} from './results'

type AdminClient = ReturnType<typeof createAdminClient>

/** How long after an event we keep re-checking it — covers late feed corrections. */
const LOOKBACK_DAYS = 4

export interface ResultChange {
  fightId: string
  fight: string
  from: string
  to: string
  source: 'ufc_api' | 'espn'
  /** corrected = stored result was wrong; filled = result was missing; flagged = admin-set result disagrees, left alone */
  action: 'corrected' | 'filled' | 'flagged'
  applied: boolean
}

export interface EventVerification {
  eventId: string
  eventName: string
  fightsChecked: number
  changes: ResultChange[]
  /** Bouts where ESPN and the UFC feed disagree (UFC was used). */
  conflicts: { fight: string; ufc: string; espn: string }[]
  /** Final fights neither feed could confirm — worth a manual look. */
  unverified: string[]
  /** Picks whose stored points didn't match their fight's result before recalculation. */
  pointsFixed: number
  sources: { ufc: boolean; espn: boolean }
}

/**
 * Backstop for live scoring: re-derives every fight result of recent events
 * from the official feeds, corrects any stored result that disagrees, and
 * re-checks every pick's points against its fight. Runs from the live-results
 * cron (every 5 min while an event is live, every 30 min for four days after)
 * and from the "Verify Results" button on /admin/status.
 *
 * Results an admin entered by hand (result_source = 'admin') are never
 * overwritten — a disagreement is only flagged.
 */
export async function runResultVerification(
  adminClient: AdminClient,
  opts: { force?: boolean; dryRun?: boolean; now?: Date } = {}
): Promise<EventVerification[]> {
  const now = opts.now ?? new Date()
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString()

  const { data: events } = await adminClient
    .from('events')
    .select('id, name, status, start_time, espn_event_id, ufc_event_fmid')
    .in('status', ['live', 'completed'])
    .gte('start_time', since)
    .lte('start_time', now.toISOString())
    .order('start_time', { ascending: false })

  const minute = now.getUTCMinutes()
  const due = (events ?? []).filter(e =>
    opts.force || (e.status === 'live' ? minute % 5 === 0 : minute % 30 === 0)
  )

  const reports: EventVerification[] = []
  for (const event of due) {
    try {
      const report = await verifyEventResults(adminClient, event, { dryRun: opts.dryRun })
      reports.push(report)
      if (!opts.dryRun) await logVerification(adminClient, event.status, report, !!opts.force)
    } catch (err) {
      console.error(`Result verification failed for ${event.name}:`, err)
      if (!opts.dryRun) {
        await adminClient.from('api_sync_log').insert({
          sync_type: 'cross_validation',
          event_id: event.id,
          api_source: 'ufc_api',
          status: 'error',
          request_count: 1,
          details: { kind: 'result_verification', error: String(err) },
        })
      }
    }
  }
  return reports
}

export async function verifyEventResults(
  adminClient: AdminClient,
  event: { id: string; name: string; start_time: string; espn_event_id: string | null; ufc_event_fmid: string | null },
  opts: { dryRun?: boolean } = {}
): Promise<EventVerification> {
  const report: EventVerification = {
    eventId: event.id,
    eventName: event.name,
    fightsChecked: 0,
    changes: [],
    conflicts: [],
    unverified: [],
    pointsFixed: 0,
    sources: { ufc: false, espn: false },
  }

  // The UFC feed is the official record — make sure we can reach it.
  let fmid = event.ufc_event_fmid
  if (!opts.dryRun) {
    try {
      fmid = await syncUfcIds(adminClient, event, { allowClaude: false })
    } catch {
      // Best-effort — ESPN can still verify on its own.
    }
  }

  const [ufcFights, espnComps] = await Promise.all([
    fmid ? fetchUfcLiveEvent(fmid).catch(() => null) : Promise.resolve(null),
    event.espn_event_id ? fetchEspnCompetitions(event.espn_event_id, event.start_time).catch(() => null) : Promise.resolve(null),
  ])
  report.sources = { ufc: !!ufcFights, espn: !!espnComps }

  const { data: fights } = await adminClient
    .from('fights')
    .select('id, red_name, blue_name, status, result_winner, result_method, result_round, result_source, espn_competition_id, ufc_fight_id')
    .eq('event_id', event.id)
    .neq('status', 'cancelled')

  const ufcById = new Map((ufcFights ?? []).map(f => [f.fightId, f]))
  const espnById = new Map((espnComps ?? []).map(c => [c.id, c]))

  for (const fight of fights ?? []) {
    report.fightsChecked++
    const label = `${fight.red_name} vs ${fight.blue_name}`

    const ufcRaw: UfcLiveFight | undefined =
      (fight.ufc_fight_id ? ufcById.get(fight.ufc_fight_id) : undefined) ??
      (ufcFights ?? []).find(f => alignUfcFight(f, fight.red_name, fight.blue_name))
    const ufcAligned = ufcRaw ? alignUfcFight(ufcRaw, fight.red_name, fight.blue_name) : null
    const ufc = ufcAligned ? ufcResult(ufcAligned) : null
    const espnComp = fight.espn_competition_id ? espnById.get(fight.espn_competition_id) : undefined
    const espn = espnComp ? espnResult(espnComp) : null

    const resolved = resolveResult(ufc, espn)
    if (resolved?.conflict) {
      report.conflicts.push({ fight: label, ufc: describeResult(ufc), espn: describeResult(espn) })
    }

    const stored = { winner: fight.result_winner, method: fight.result_method, round: fight.result_round }
    const isFinal = fight.status === 'final'
    // Hand-entered results and fights an admin marked no-contest are human
    // decisions: report a disagreement, never overwrite it.
    const humanDecided = fight.result_source === 'admin' || fight.status === 'no_contest'

    if (!resolved) {
      if (isFinal) report.unverified.push(label)
      continue
    }
    if (isFinal && sameResult(stored, resolved.result)) continue
    if (fight.status === 'no_contest' && resolved.result.winner === 'nc') continue

    const change: ResultChange = {
      fightId: fight.id,
      fight: label,
      from: isFinal ? describeResult(stored) : 'none',
      to: describeResult(resolved.result),
      source: resolved.source,
      action: humanDecided ? 'flagged' : isFinal ? 'corrected' : 'filled',
      applied: false,
    }

    if (change.action !== 'flagged' && !opts.dryRun) {
      change.applied = await writeResult(adminClient, fight.id, resolved.result)
    }
    report.changes.push(change)
  }

  report.pointsFixed = await checkPickPoints(adminClient, event.id)
  const needsRecalc = report.changes.some(c => c.applied) || report.pointsFixed > 0
  if (needsRecalc && !opts.dryRun) {
    const { error } = await adminClient.rpc('recalculate_event_picks', { p_event_id: event.id })
    if (error) throw new Error(`recalculate_event_picks failed: ${error.message}`)
  }

  if (report.changes.some(c => c.applied && c.action === 'filled')) {
    await completeEventIfDone(adminClient, event.id)
  }

  return report
}

/** Mark a live event completed once the verifier has filled in its last result. */
async function completeEventIfDone(adminClient: AdminClient, eventId: string) {
  const { data: fights } = await adminClient.from('fights').select('status').eq('event_id', eventId)
  const TERMINAL = ['final', 'cancelled', 'no_contest']
  if (fights && fights.length > 0 && fights.every(f => TERMINAL.includes(f.status))) {
    await adminClient.from('events').update({ status: 'completed' }).eq('id', eventId).eq('status', 'live')
  }
}

async function writeResult(adminClient: AdminClient, fightId: string, result: FightResult): Promise<boolean> {
  const { error } = await adminClient.from('fights').update({
    result_winner: result.winner,
    result_method: result.method,
    result_round: result.round,
    result_source: 'verified',
    status: 'final',
  }).eq('id', fightId)
  if (error) console.error(`Result verification could not update fight ${fightId}:`, error.message)
  return !error
}

/**
 * Count picks whose stored points disagree with their fight's current result,
 * using the same 5-3-2 rules as recalculate_event_picks. Anything non-zero means
 * a result changed without the boards being recalculated.
 */
async function checkPickPoints(adminClient: AdminClient, eventId: string): Promise<number> {
  const { data: picks } = await adminClient
    .from('picks')
    .select('pick_winner, pick_method, pick_round, points_earned, fights!inner(status, result_winner, result_method, result_round)')
    .eq('event_id', eventId)

  let wrong = 0
  for (const pick of picks ?? []) {
    const fight = pick.fights as unknown as {
      status: string; result_winner: string | null; result_method: string | null; result_round: number | null
    }
    const expected = fight.status === 'final'
      ? calculatePoints(
          { pick_winner: pick.pick_winner as PickWinner, pick_method: pick.pick_method as PickMethod, pick_round: pick.pick_round },
          {
            result_winner: fight.result_winner as ResultWinner | null,
            result_method: fight.result_method as ResultMethod | null,
            result_round: fight.result_round,
          }
        ).points
      : null
    if (pick.points_earned !== expected) wrong++
  }
  return wrong
}

/** The ESPN competitions for one event, looked up on the scoreboard around its date. */
async function fetchEspnCompetitions(espnEventId: string, startTime: string): Promise<EspnCompetition[] | null> {
  const day = 24 * 3600 * 1000
  const t = new Date(startTime).getTime()
  const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '')
  const board = await fetchScoreboard(`${ymd(t - day)}-${ymd(t + day)}`)
  return board.events?.find(e => e.id === espnEventId)?.competitions ?? null
}

async function logVerification(
  adminClient: AdminClient,
  eventStatus: string,
  report: EventVerification,
  manual: boolean
) {
  const notable = report.changes.length > 0 || report.conflicts.length > 0 || report.pointsFixed > 0
  // Completed events are re-checked every 30 min for days — only log when
  // something turned up, so the activity feed isn't buried in heartbeats.
  if (!notable && eventStatus !== 'live' && !manual) return

  const noSources = !report.sources.ufc && !report.sources.espn
  await adminClient.from('api_sync_log').insert({
    sync_type: 'cross_validation',
    event_id: report.eventId,
    api_source: report.sources.ufc ? 'ufc_api' : 'espn',
    status: notable ? 'warning' : noSources ? 'error' : 'success',
    request_count: Number(report.sources.ufc) + Number(report.sources.espn),
    details: {
      kind: 'result_verification',
      manual,
      fightsChecked: report.fightsChecked,
      changes: report.changes.length > 0 ? report.changes : undefined,
      conflicts: report.conflicts.length > 0 ? report.conflicts : undefined,
      unverified: report.unverified.length > 0 ? report.unverified : undefined,
      pointsFixed: report.pointsFixed || undefined,
    } as unknown as Json,
  })
}
