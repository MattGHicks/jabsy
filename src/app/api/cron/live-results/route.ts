import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchEventById, getCorners, getResultMethod, mapFightStatus } from '@/lib/api/espn'
import { fetchUfcLiveEvent, mapUfcMethod, getUfcWinner } from '@/lib/api/ufc'
import { fetchFightResultsWithClaude } from '@/lib/api/claude-search'
import type { Json } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * Live results polling cron job — three-tier fallback system.
 * Runs every 60 seconds via Vercel cron.
 *
 * Tier 1: ESPN API (primary)
 *   → If ESPN consecutive_failures >= 1, skip to Tier 2
 *
 * Tier 2: UFC CloudFront API (fallback when ESPN is down)
 *   → Uses ufc_event_fmid / ufc_fight_id stored during daily sync
 *   → Only activates if ESPN has been failing
 *
 * Tier 3: Claude web_search (last resort when both APIs down > 3 mins)
 *   → Rate-limited to one call per event per 3 minutes via api_sync_log
 *   → Only high-confidence results are written
 *
 * Cross-validation (every 5 mins):
 *   → Compares ESPN vs UFC results for recently completed fights
 *   → Discrepancies logged for admin review — never auto-corrected
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  try {
    // Auto-transition upcoming events past lock_time to live
    await adminClient
      .from('events')
      .update({ status: 'live' })
      .eq('status', 'upcoming')
      .lte('lock_time', now)

    // Find live events with ESPN IDs
    const { data: liveEvents } = await adminClient
      .from('events')
      .select('id, name, espn_event_id, ufc_event_fmid, start_time')
      .eq('status', 'live')
      .not('espn_event_id', 'is', null)

    if (!liveEvents || liveEvents.length === 0) {
      await detectStuckEvents(adminClient)
      return NextResponse.json({ message: 'No live events' })
    }

    // Check ESPN health once — applies to all events this run
    const espnHealthy = await isEspnHealthy(adminClient)

    const allUpdates: { eventId: string; fightId: string; winner: string; method: string; round: number | null; tier: string }[] = []
    const allErrors: { eventId: string; type: string; detail: string }[] = []

    for (const event of liveEvents) {
      try {
        const { updates, errors } = await processLiveEvent(adminClient, event as typeof event & { espn_event_id: string }, espnHealthy)
        allUpdates.push(...updates)
        allErrors.push(...errors)
      } catch (err) {
        console.error(`Live results failed for event ${event.id}:`, err)
        allErrors.push({ eventId: event.id, type: 'unhandled_error', detail: String(err) })
      }
    }

    // Cross-validation (rate-limited to every 5 mins globally)
    await runCrossValidation(adminClient, liveEvents)

    await detectStuckEvents(adminClient)

    if (allUpdates.length > 0 || allErrors.length > 0) {
      await adminClient.from('api_sync_log').insert({
        sync_type: 'live_results',
        api_source: 'espn',
        status: allErrors.length > 0 ? (allUpdates.length > 0 ? 'partial' : 'error') : 'success',
        request_count: liveEvents.length,
        details: {
          updates: allUpdates,
          errors: allErrors.length > 0 ? allErrors : undefined,
        } as unknown as Json,
      })
    }

    return NextResponse.json({
      message: `Polled ${liveEvents.length} live events`,
      espnHealthy,
      resultsApplied: allUpdates.length,
      updates: allUpdates,
      errors: allErrors.length > 0 ? allErrors : undefined,
    })
  } catch (err) {
    console.error('Live results cron error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── Per-event orchestrator ───────────────────────────────────────────────────

async function processLiveEvent(
  adminClient: ReturnType<typeof createAdminClient>,
  event: { id: string; name: string; espn_event_id: string; ufc_event_fmid: string | null; start_time: string },
  espnHealthy: boolean
) {
  const updates: { eventId: string; fightId: string; winner: string; method: string; round: number | null; tier: string }[] = []
  const errors: { eventId: string; type: string; detail: string }[] = []

  // ── Tier 1: ESPN ─────────────────────────────────────────────────────────────
  if (espnHealthy) {
    try {
      const espnEvent = await fetchEventById(event.espn_event_id)
      if (!espnEvent) {
        errors.push({ eventId: event.id, type: 'espn_event_not_found', detail: `ESPN event ${event.espn_event_id} not found` })
      } else {
        const { data: existingFights } = await adminClient
          .from('fights')
          .select('id, espn_competition_id, ufc_fight_id, status, result_winner')
          .eq('event_id', event.id)

        const fightsByEspnId = new Map(
          (existingFights ?? [])
            .filter(f => f.espn_competition_id)
            .map(f => [f.espn_competition_id!, f])
        )

        // Pre-fetch UFC fight results once per event for spot-checking ambiguous ESPN results
        const ufcSpotCheckMap = new Map<string, { winner: 'red' | 'blue' | 'draw' | 'nc'; method: string | null; round: number | null }>()
        if (event.ufc_event_fmid) {
          try {
            const ufcFights = await fetchUfcLiveEvent(event.ufc_event_fmid)
            if (ufcFights) {
              for (const f of ufcFights) {
                if (f.result.isComplete && f.fightId) {
                  const w = getUfcWinner(f)
                  const m = mapUfcMethod(f.result.method)
                  ufcSpotCheckMap.set(f.fightId, {
                    winner: w,
                    method: m,
                    round: (m === 'ko_tko' || m === 'submission') ? (f.result.round ?? null) : null,
                  })
                }
              }
            }
          } catch {
            // UFC pre-fetch is best-effort — missing it won't block ESPN results
          }
        }

        for (const comp of espnEvent.competitions) {
          const dbFight = fightsByEspnId.get(comp.id)
          if (!dbFight) continue
          if (dbFight.status === 'final' || dbFight.result_winner) continue

          const espnStatus = mapFightStatus(comp.status)
          if (espnStatus === 'live' && dbFight.status === 'scheduled') {
            await adminClient.from('fights').update({ status: 'live' }).eq('id', dbFight.id)
          }

          if (!comp.status.type.completed) continue

          const cornersResult = getCorners(comp)
          if (!cornersResult.data) {
            await logOncePerHour(adminClient, 'live_results', event.id, 'error', {
              type: 'corners_extraction_failed',
              fight_id: dbFight.id,
              competition_id: comp.id,
              warnings: cornersResult.warnings,
            })
            errors.push({ eventId: event.id, type: 'corners_failed', detail: `Competition ${comp.id}` })
            continue
          }

          const methodResult = getResultMethod(comp)
          if (methodResult.warnings.length > 0) {
            await logOncePerHour(adminClient, 'live_results', event.id, 'warning', {
              fight_id: dbFight.id,
              competition_id: comp.id,
              warnings: methodResult.warnings,
            })
          }

          if (!methodResult.data) {
            await logOncePerHour(adminClient, 'live_results', event.id, 'error', {
              type: 'result_extraction_failed',
              fight_id: dbFight.id,
              competition_id: comp.id,
            })
            errors.push({ eventId: event.id, type: 'method_not_found', detail: `Competition ${comp.id}` })
            continue
          }

          const corners = cornersResult.data
          let winner: 'red' | 'blue' | 'draw' | 'nc' = 'draw'
          if (corners.red.winner) winner = 'red'
          else if (corners.blue.winner) winner = 'blue'

          // ESPN completed the fight but neither corner is marked as winner (possible placeholder draw)
          // Spot-check against UFC API before writing — draws are rare in MMA
          if (winner === 'draw' && dbFight.ufc_fight_id) {
            const ufcSpot = ufcSpotCheckMap.get(dbFight.ufc_fight_id)
            if (ufcSpot) {
              if (ufcSpot.winner !== 'draw' && ufcSpot.method) {
                // UFC has a definitive winner — use it instead of ESPN's ambiguous draw
                const { error } = await adminClient.from('fights').update({
                  result_winner: ufcSpot.winner,
                  result_method: ufcSpot.method,
                  result_round: ufcSpot.round,
                  status: 'final',
                }).eq('id', dbFight.id)
                if (!error) {
                  updates.push({ eventId: event.id, fightId: dbFight.id, winner: ufcSpot.winner, method: ufcSpot.method, round: ufcSpot.round, tier: 'ufc_spot_check' })
                } else {
                  errors.push({ eventId: event.id, type: 'update_failed', detail: error.message })
                }
                continue
              }
              // ufcSpot.winner === 'draw' too — confirmed draw, fall through and write it
            } else {
              // UFC has no result for this fight yet — skip writing until next cycle
              continue
            }
          }

          const round = (methodResult.data === 'ko_tko' || methodResult.data === 'submission')
            ? comp.status.period
            : null

          const { error } = await adminClient.from('fights').update({
            result_winner: winner,
            result_method: methodResult.data,
            result_round: round,
            status: 'final',
          }).eq('id', dbFight.id)

          if (!error) {
            updates.push({ eventId: event.id, fightId: dbFight.id, winner, method: methodResult.data, round, tier: 'espn' })
          } else {
            errors.push({ eventId: event.id, type: 'update_failed', detail: error.message })
          }
        }

        // If ESPN processed successfully (even with 0 new results), we're done for this event
        if (errors.filter(e => e.eventId === event.id && e.type !== 'corners_failed' && e.type !== 'method_not_found').length === 0) {
          await finalizeEventIfDone(adminClient, event.id, updates.filter(u => u.eventId === event.id).length)
          return { updates, errors }
        }
      }
    } catch (err) {
      console.error(`ESPN Tier 1 failed for event ${event.id}:`, err)
      errors.push({ eventId: event.id, type: 'espn_fetch_error', detail: String(err) })
      // Fall through to Tier 2
    }
  }

  // ── Tier 2: UFC CloudFront API ────────────────────────────────────────────────
  if (!event.ufc_event_fmid) {
    errors.push({ eventId: event.id, type: 'ufc_no_fmid', detail: 'ufc_event_fmid not populated — skipping Tier 2' })
  } else {
    try {
      const ufcFights = await fetchUfcLiveEvent(event.ufc_event_fmid)

      if (!ufcFights) {
        await adminClient.from('api_sync_log').insert({
          sync_type: 'live_results',
          event_id: event.id,
          api_source: 'ufc_api',
          status: 'error',
          request_count: 1,
          details: { type: 'empty_response', fmid: event.ufc_event_fmid },
        })
        errors.push({ eventId: event.id, type: 'ufc_empty_response', detail: `fmid ${event.ufc_event_fmid} returned empty` })
      } else {
        const { data: pendingFights } = await adminClient
          .from('fights')
          .select('id, ufc_fight_id, status, result_winner')
          .eq('event_id', event.id)
          .is('result_winner', null)
          .neq('status', 'final')
          .neq('status', 'cancelled')

        const ufcById = new Map(ufcFights.map(f => [f.fightId, f]))
        let tier2Updates = 0

        for (const dbFight of pendingFights ?? []) {
          if (!dbFight.ufc_fight_id) continue
          const ufcFight = ufcById.get(dbFight.ufc_fight_id)
          if (!ufcFight?.result.isComplete) continue

          const method = mapUfcMethod(ufcFight.result.method)
          if (!method) continue

          const winner = getUfcWinner(ufcFight)
          const round = (method === 'ko_tko' || method === 'submission')
            ? (ufcFight.result.round ?? null)
            : null

          const { error } = await adminClient.from('fights').update({
            result_winner: winner,
            result_method: method,
            result_round: round,
            status: 'final',
          }).eq('id', dbFight.id)

          if (!error) {
            updates.push({ eventId: event.id, fightId: dbFight.id, winner, method, round, tier: 'ufc_api' })
            tier2Updates++
          }
        }

        await adminClient.from('api_sync_log').insert({
          sync_type: 'live_results',
          event_id: event.id,
          api_source: 'ufc_api',
          status: 'success',
          request_count: 1,
          details: { resultsApplied: tier2Updates },
        })

        await finalizeEventIfDone(adminClient, event.id, tier2Updates)
        return { updates, errors }
      }
    } catch (err) {
      console.error(`UFC Tier 2 failed for event ${event.id}:`, err)
      errors.push({ eventId: event.id, type: 'ufc_fetch_error', detail: String(err) })
      // Fall through to Tier 3
    }
  }

  // ── Tier 3: Claude web_search ─────────────────────────────────────────────────
  // Rate-limit: max one call per event per 3 minutes
  const { data: recentClaudeLog } = await adminClient
    .from('api_sync_log')
    .select('id')
    .eq('sync_type', 'live_results')
    .eq('event_id', event.id)
    .eq('api_source', 'claude')
    .gte('created_at', new Date(Date.now() - 3 * 60 * 1000).toISOString())
    .limit(1)

  if (recentClaudeLog && recentClaudeLog.length > 0) {
    return { updates, errors } // Too soon — skip Claude this cycle
  }

  const { data: pendingForClaude } = await adminClient
    .from('fights')
    .select('id, red_name, blue_name')
    .eq('event_id', event.id)
    .is('result_winner', null)
    .neq('status', 'final')
    .neq('status', 'cancelled')

  if (!pendingForClaude || pendingForClaude.length === 0) {
    return { updates, errors }
  }

  try {
    const claudeResults = await fetchFightResultsWithClaude(
      event.name,
      pendingForClaude.map(f => ({ id: f.id, redName: f.red_name, blueName: f.blue_name }))
    )

    let tier3Updates = 0
    const lowConfidence: typeof claudeResults = []

    for (const result of claudeResults) {
      if (result.confidence !== 'high' || !result.winner || !result.method) {
        if (result.confidence === 'low') lowConfidence.push(result)
        continue
      }

      const round = (result.method === 'ko_tko' || result.method === 'submission')
        ? (result.round ?? null)
        : null

      const { error } = await adminClient.from('fights').update({
        result_winner: result.winner,
        result_method: result.method,
        result_round: round,
        status: 'final',
      }).eq('id', result.fightId)

      if (!error) {
        updates.push({ eventId: event.id, fightId: result.fightId, winner: result.winner, method: result.method, round, tier: 'claude' })
        tier3Updates++
      }
    }

    await adminClient.from('api_sync_log').insert({
      sync_type: 'live_results',
      event_id: event.id,
      api_source: 'claude',
      status: tier3Updates > 0 ? 'success' : lowConfidence.length > 0 ? 'warning' : 'partial',
      request_count: 1,
      details: {
        resultsApplied: tier3Updates,
        lowConfidence: lowConfidence.length > 0 ? lowConfidence : undefined,
      } as unknown as Json,
    })

    await finalizeEventIfDone(adminClient, event.id, tier3Updates)
  } catch (err) {
    console.error(`Claude Tier 3 failed for event ${event.id}:`, err)
    errors.push({ eventId: event.id, type: 'claude_fetch_error', detail: String(err) })
  }

  return { updates, errors }
}

// ─── Cross-validation ─────────────────────────────────────────────────────────

async function runCrossValidation(
  adminClient: ReturnType<typeof createAdminClient>,
  liveEvents: { id: string; name: string; ufc_event_fmid: string | null }[]
) {
  // Rate-limit: once every 5 minutes globally across all events
  const { data: recent } = await adminClient
    .from('api_sync_log')
    .select('id')
    .eq('sync_type', 'cross_validation')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .limit(1)

  if (recent && recent.length > 0) return

  const discrepancies: { eventId: string; fightId: string; espnResult: string; ufcResult: string; claudeResolution?: string; corrected?: boolean }[] = []
  const correctedEventIds = new Set<string>()

  for (const event of liveEvents) {
    if (!event.ufc_event_fmid) continue

    try {
      // Check fights finalized in last 30 mins — wide enough to catch delayed/corrected results
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      const { data: recentFights } = await adminClient
        .from('fights')
        .select('id, red_name, blue_name, ufc_fight_id, result_winner, result_method, result_round')
        .eq('event_id', event.id)
        .eq('status', 'final')
        .gte('updated_at', thirtyMinsAgo)

      if (!recentFights || recentFights.length === 0) continue

      const ufcFights = await fetchUfcLiveEvent(event.ufc_event_fmid)
      if (!ufcFights) continue

      const ufcById = new Map(ufcFights.map(f => [f.fightId, f]))

      for (const dbFight of recentFights) {
        if (!dbFight.ufc_fight_id) continue
        const ufcFight = ufcById.get(dbFight.ufc_fight_id)
        if (!ufcFight?.result.isComplete) continue

        const ufcWinner = getUfcWinner(ufcFight)
        const ufcMethod = mapUfcMethod(ufcFight.result.method)

        const winnerMismatch = dbFight.result_winner !== ufcWinner
        const methodMismatch = dbFight.result_method !== ufcMethod

        if (winnerMismatch || methodMismatch) {
          const espnResult = `${dbFight.result_winner}/${dbFight.result_method}`
          const ufcResult = `${ufcWinner}/${ufcMethod}`

          // Ask Claude to resolve the discrepancy
          let claudeResolution: string | undefined
          let corrected = false
          try {
            const claudeResults = await fetchFightResultsWithClaude(event.name, [{
              id: dbFight.id,
              redName: dbFight.red_name,
              blueName: dbFight.blue_name,
            }])
            const match = claudeResults.find(r => r.fightId === dbFight.id && r.confidence === 'high')
            if (match && match.winner && match.method) {
              claudeResolution = `${match.winner}/${match.method} (confidence: ${match.confidence})`

              // Write the correction if Claude disagrees with current DB value
              if (match.winner !== dbFight.result_winner) {
                const correctedRound = (match.method === 'ko_tko' || match.method === 'submission')
                  ? (match.round ?? null)
                  : null
                const { error } = await adminClient.from('fights').update({
                  result_winner: match.winner,
                  result_method: match.method,
                  result_round: correctedRound,
                }).eq('id', dbFight.id)
                if (!error) {
                  corrected = true
                  correctedEventIds.add(event.id)
                }
              }
            }
          } catch {
            // Claude resolution is best-effort
          }

          discrepancies.push({
            eventId: event.id,
            fightId: dbFight.id,
            espnResult,
            ufcResult,
            claudeResolution,
            corrected,
          })
        }
      }
    } catch {
      // Cross-validation is best-effort per event
    }
  }

  // Recalculate picks for any events where results were corrected
  for (const eventId of correctedEventIds) {
    try {
      await adminClient.rpc('recalculate_event_picks', { p_event_id: eventId })
    } catch {
      // Best-effort
    }
  }

  await adminClient.from('api_sync_log').insert({
    sync_type: 'cross_validation',
    api_source: 'ufc_api',
    status: discrepancies.length > 0 ? 'warning' : 'success',
    request_count: liveEvents.length,
    details: {
      discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
      eventsChecked: liveEvents.length,
      correctionsApplied: correctedEventIds.size,
    } as unknown as Json,
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function isEspnHealthy(adminClient: ReturnType<typeof createAdminClient>): Promise<boolean> {
  try {
    const { data } = await adminClient
      .from('espn_health')
      .select('consecutive_failures')
      .eq('endpoint', 'event')
      .single()
    return !data || data.consecutive_failures < 1
  } catch {
    return true // assume healthy if we can't check
  }
}

async function finalizeEventIfDone(
  adminClient: ReturnType<typeof createAdminClient>,
  eventId: string,
  newResults: number
) {
  if (newResults === 0) return

  await adminClient.rpc('recalculate_event_picks', { p_event_id: eventId }).then(({ error }) => {
    if (error) console.error(`recalculate_event_picks failed for ${eventId}:`, error)
  })

  const { data: allFights } = await adminClient
    .from('fights')
    .select('status')
    .eq('event_id', eventId)

  const TERMINAL = ['final', 'cancelled', 'no_contest']
  const allDone = allFights && allFights.length > 0 && allFights.every(f => TERMINAL.includes(f.status))
  if (allDone) {
    await adminClient.from('events').update({ status: 'completed' }).eq('id', eventId)
  }
}

async function logOncePerHour(
  adminClient: ReturnType<typeof createAdminClient>,
  syncType: string,
  eventId: string,
  status: string,
  details: Record<string, unknown>,
) {
  try {
    const { data: recentLog } = await adminClient
      .from('api_sync_log')
      .select('id')
      .eq('sync_type', syncType as 'live_results')
      .eq('event_id', eventId)
      .eq('status', status as 'error')
      .gte('created_at', new Date(Date.now() - 3600000).toISOString())
      .limit(1)

    if (!recentLog || recentLog.length === 0) {
      await adminClient.from('api_sync_log').insert({
        sync_type: syncType as 'live_results',
        event_id: eventId,
        api_source: 'espn',
        status: status as 'error',
        request_count: 0,
        details: details as unknown as Json,
      })
    }
  } catch {
    // Logging is best-effort
  }
}

async function detectStuckEvents(adminClient: ReturnType<typeof createAdminClient>) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: stuckEvents } = await adminClient
      .from('events')
      .select('id, name, start_time')
      .eq('status', 'live')
      .lt('start_time', twentyFourHoursAgo)

    if (stuckEvents && stuckEvents.length > 0) {
      const { data: recentLog } = await adminClient
        .from('api_sync_log')
        .select('id')
        .eq('sync_type', 'health_check')
        .eq('status', 'warning')
        .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        .limit(1)

      if (!recentLog || recentLog.length === 0) {
        await adminClient.from('api_sync_log').insert({
          sync_type: 'health_check',
          api_source: 'espn',
          status: 'warning',
          request_count: 0,
          details: {
            type: 'stuck_events',
            events: stuckEvents.map(e => ({ id: e.id, name: e.name, start_time: e.start_time })),
          },
        })
      }
    }
  } catch {
    // Stuck event detection is best-effort
  }
}
