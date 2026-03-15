'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchFightResultsWithClaude } from '@/lib/api/claude-search'

export interface SystemTestResult {
  espn: { ok: boolean; latencyMs: number; error?: string }
  ufc: { ok: boolean; latencyMs: number; error?: string }
  claude: { ok: boolean; error?: string }
  supabase: { ok: boolean; latencyMs: number; error?: string }
  ranAt: string
}

export async function runSystemTest(): Promise<SystemTestResult> {
  await requireAdmin()

  const [espnResult, ufcResult, supabaseResult] = await Promise.all([
    // Test ESPN API
    (async () => {
      const start = Date.now()
      try {
        const res = await fetch(
          'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
          { signal: AbortSignal.timeout(6000) }
        )
        return { ok: res.ok, latencyMs: Date.now() - start, error: res.ok ? undefined : `HTTP ${res.status}` }
      } catch (err) {
        return { ok: false, latencyMs: Date.now() - start, error: String(err).slice(0, 100) }
      }
    })(),

    // Test UFC CloudFront API
    (async () => {
      const start = Date.now()
      try {
        const res = await fetch(
          'https://d29dxerjsp82wz.cloudfront.net/api/v3/event/live/1300.json',
          { signal: AbortSignal.timeout(6000) }
        )
        if (!res.ok) return { ok: false, latencyMs: Date.now() - start, error: `HTTP ${res.status}` }
        const data = await res.json() as { LiveEventDetail?: unknown }
        return { ok: 'LiveEventDetail' in data, latencyMs: Date.now() - start }
      } catch (err) {
        return { ok: false, latencyMs: Date.now() - start, error: String(err).slice(0, 100) }
      }
    })(),

    // Test Supabase
    (async () => {
      const start = Date.now()
      try {
        const admin = createAdminClient()
        const { error } = await admin.from('events').select('id', { count: 'exact', head: true })
        return { ok: !error, latencyMs: Date.now() - start, error: error?.message }
      } catch (err) {
        return { ok: false, latencyMs: Date.now() - start, error: String(err).slice(0, 100) }
      }
    })(),
  ])

  // Claude: just verify key is configured (no API call to save cost)
  let claudeOk = false
  let claudeError: string | undefined
  try {
    const key = process.env.ANTHROPIC_API_KEY?.trim()
    if (key) {
      claudeOk = true
    } else {
      const { readFileSync } = await import('fs')
      const { join } = await import('path')
      const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
      const match = envFile.match(/^ANTHROPIC_API_KEY=(.+)$/m)
      claudeOk = !!(match?.[1]?.trim())
      if (!claudeOk) claudeError = 'API key not configured'
    }
  } catch {
    claudeError = 'Could not read API key'
  }

  return {
    espn: espnResult,
    ufc: ufcResult,
    claude: { ok: claudeOk, error: claudeError },
    supabase: supabaseResult,
    ranAt: new Date().toISOString(),
  }
}

/**
 * Treat a datetime-local string (YYYY-MM-DDTHH:MM, no tz info) as Eastern Time
 * and return a proper UTC ISO string for storage in Postgres.
 */
function easternToUTC(localStr: string): string {
  if (!localStr) return localStr
  // Parse as if UTC to get a Date object for offset lookup
  const tempDate = new Date(localStr + ':00Z')
  // Find the ET offset by comparing UTC vs ET representation of tempDate
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(tempDate).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value
    return acc
  }, {})
  const etAsUTC = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`
  )
  // offsetMs: how many ms ahead UTC is of ET (e.g. +14400000 for EDT UTC-4)
  const offsetMs = tempDate.getTime() - etAsUTC.getTime()
  return new Date(tempDate.getTime() + offsetMs).toISOString()
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')
  return { supabase, user }
}

export async function createEvent(formData: FormData) {
  const { supabase, user } = await requireAdmin()

  const name = (formData.get('name') as string)?.trim()
  const start_time = formData.get('start_time') as string
  const venue = (formData.get('venue') as string)?.trim() || null
  const status = ((formData.get('status') as string) || 'upcoming') as 'upcoming' | 'live' | 'completed' | 'cancelled'

  if (!name || !start_time) redirect('/admin/events/new?error=Name+and+date+are+required')

  const start_time_utc = easternToUTC(start_time)

  const { data, error } = await supabase
    .from('events')
    .insert({ name, start_time: start_time_utc, lock_time: start_time_utc, venue, status, created_by: user.id })
    .select('id')
    .single()

  if (error) redirect(`/admin/events/new?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin')
  redirect(`/admin/events/${data.id}`)
}

export async function updateEvent(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = formData.get('id') as string
  const name = (formData.get('name') as string)?.trim()
  const start_time = formData.get('start_time') as string
  const venue = (formData.get('venue') as string)?.trim() || null
  const status = formData.get('status') as 'upcoming' | 'live' | 'completed' | 'cancelled'

  const start_time_utc = easternToUTC(start_time)

  const { error } = await supabase
    .from('events')
    .update({ name, start_time: start_time_utc, lock_time: start_time_utc, venue, status })
    .eq('id', id)

  if (error) redirect(`/admin/events/${id}/edit?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin')
  revalidatePath(`/admin/events/${id}`)
  redirect(`/admin/events/${id}`)
}

export async function deleteEvent(id: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('events').delete().eq('id', id)
  revalidatePath('/admin')
  redirect('/admin')
}

export async function createFight(formData: FormData) {
  const { supabase } = await requireAdmin()

  const event_id = formData.get('event_id') as string
  const red_name = (formData.get('red_name') as string)?.trim()
  const blue_name = (formData.get('blue_name') as string)?.trim()
  const scheduled_rounds = parseInt(formData.get('scheduled_rounds') as string) || 3
  const bout_order = parseInt(formData.get('bout_order') as string) || 1
  const is_main_event = formData.get('is_main_event') === 'on'
  const red_record = (formData.get('red_record') as string)?.trim() || null
  const blue_record = (formData.get('blue_record') as string)?.trim() || null
  const red_sherdog_url = (formData.get('red_sherdog_url') as string)?.trim() || null
  const blue_sherdog_url = (formData.get('blue_sherdog_url') as string)?.trim() || null

  if (!red_name || !blue_name) redirect(`/admin/events/${event_id}?error=Fighter+names+required`)

  const { error } = await supabase.from('fights').insert({
    event_id,
    red_name,
    blue_name,
    scheduled_rounds,
    bout_order,
    is_main_event,
    red_record,
    blue_record,
    red_sherdog_url,
    blue_sherdog_url,
  })

  if (error) redirect(`/admin/events/${event_id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath(`/admin/events/${event_id}`)
  redirect(`/admin/events/${event_id}`)
}

export async function updateFight(formData: FormData) {
  const { supabase } = await requireAdmin()

  const id = formData.get('id') as string
  const event_id = formData.get('event_id') as string
  const red_name = (formData.get('red_name') as string)?.trim()
  const blue_name = (formData.get('blue_name') as string)?.trim()
  const scheduled_rounds = parseInt(formData.get('scheduled_rounds') as string) || 3
  const bout_order = parseInt(formData.get('bout_order') as string) || 1
  const is_main_event = formData.get('is_main_event') === 'on'
  const red_record = (formData.get('red_record') as string)?.trim() || null
  const blue_record = (formData.get('blue_record') as string)?.trim() || null
  const red_sherdog_url = (formData.get('red_sherdog_url') as string)?.trim() || null
  const blue_sherdog_url = (formData.get('blue_sherdog_url') as string)?.trim() || null

  const { error } = await supabase
    .from('fights')
    .update({ red_name, blue_name, scheduled_rounds, bout_order, is_main_event, red_record, blue_record, red_sherdog_url, blue_sherdog_url })
    .eq('id', id)

  if (error) redirect(`/admin/events/${event_id}?error=${encodeURIComponent(error.message)}`)

  revalidatePath(`/admin/events/${event_id}`)
  redirect(`/admin/events/${event_id}`)
}

export async function deleteFight(fightId: string, eventId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('fights').delete().eq('id', fightId)
  revalidatePath(`/admin/events/${eventId}`)
  redirect(`/admin/events/${eventId}`)
}

export async function saveResult(data: {
  fight_id: string
  event_id: string
  result_winner: string
  result_method: string
  result_round: number | null
}): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireAdmin()

  // For draw/nc methods, auto-set the winner field
  const effectiveWinner = data.result_method === 'draw' ? 'draw'
    : data.result_method === 'nc' ? 'nc'
    : data.result_winner

  const { error } = await supabase
    .from('fights')
    .update({
      result_winner: effectiveWinner as 'red' | 'blue' | 'draw' | 'nc',
      result_method: data.result_method as 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc' | 'draw' | null,
      result_round: data.result_round,
      status: 'final' as const,
    })
    .eq('id', data.fight_id)

  if (error) return { success: false, error: error.message }

  const adminClient = createAdminClient()
  await adminClient.rpc('recalculate_event_picks', { p_event_id: data.event_id })

  // Auto-complete event if all fights are now final/cancelled/no_contest
  const { data: allFights } = await adminClient
    .from('fights')
    .select('status')
    .eq('event_id', data.event_id)

  const TERMINAL_STATUSES = ['final', 'cancelled', 'no_contest']
  const allDone =
    allFights &&
    allFights.length > 0 &&
    allFights.every((f) => TERMINAL_STATUSES.includes(f.status))

  if (allDone) {
    await adminClient
      .from('events')
      .update({ status: 'completed' })
      .eq('id', data.event_id)
  }

  revalidatePath('/leagues', 'layout')

  return { success: true }
}

export async function clearResult(fightId: string, eventId: string): Promise<{ success: boolean; error?: string }> {
  const { supabase } = await requireAdmin()

  const { error } = await supabase
    .from('fights')
    .update({
      result_winner: null,
      result_method: null,
      result_round: null,
      status: 'scheduled' as const,
    })
    .eq('id', fightId)

  if (error) return { success: false, error: error.message }

  const adminClient = createAdminClient()
  await adminClient.rpc('recalculate_event_picks', { p_event_id: eventId })

  revalidatePath('/leagues', 'layout')

  return { success: true }
}

export async function reorderFights(eventId: string, orderedIds: string[]): Promise<void> {
  const { supabase } = await requireAdmin()
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('fights').update({ bout_order: index + 1 }).eq('id', id)
    )
  )
  revalidatePath(`/admin/events/${eventId}`)
}

export async function setFightStatus(fightId: string, status: 'scheduled' | 'live' | 'final' | 'cancelled' | 'no_contest', eventId: string) {
  const { supabase } = await requireAdmin()
  await supabase.from('fights').update({ status }).eq('id', fightId)
  revalidatePath(`/admin/events/${eventId}`)
}

export async function setEventStatus(eventId: string, status: 'upcoming' | 'live' | 'completed' | 'cancelled') {
  const { supabase } = await requireAdmin()
  await supabase.from('events').update({ status }).eq('id', eventId)
  revalidatePath('/admin')
  revalidatePath(`/admin/events/${eventId}`)
}

/**
 * Backfill Sherdog URLs for fights that still have search-style URLs.
 * Calls Claude API with web search to find exact profile URLs.
 */
export async function backfillSherdogUrls(): Promise<{ success: boolean; updated: number; remaining: number; error?: string }> {
  await requireAdmin()
  const adminClient = createAdminClient()

  // Get all fights with search URLs
  const { data: fights, error: fetchError } = await adminClient
    .from('fights')
    .select('id, red_name, red_sherdog_url, blue_name, blue_sherdog_url, event_id')
    .or('red_sherdog_url.like.%fightfinder%,blue_sherdog_url.like.%fightfinder%')

  if (fetchError || !fights) {
    return { success: false, updated: 0, remaining: 0, error: fetchError?.message ?? 'Failed to fetch fights' }
  }

  if (fights.length === 0) {
    return { success: true, updated: 0, remaining: 0 }
  }

  // Dynamically import to avoid issues when key isn't present
  const { lookupSherdogUrls, lookupSherdogUrlsWithAI } = await import('@/lib/api/claude-search')

  // Collect all unique fighter names needing lookup
  const allNamesNeeding = new Set<string>()
  for (const f of fights) {
    if (f.red_sherdog_url?.includes('fightfinder')) allNamesNeeding.add(f.red_name)
    if (f.blue_sherdog_url?.includes('fightfinder')) allNamesNeeding.add(f.blue_name)
  }

  let totalUpdated = 0
  const errors: string[] = []

  // Step 1: Try direct scraping first
  let urls: Record<string, string> = {}
  try {
    const scraperResult = await lookupSherdogUrls([...allNamesNeeding])
    urls = scraperResult.results
    const scraperFound = Object.keys(urls).length
    errors.push(`Scraper: found ${scraperFound}/${allNamesNeeding.size}`)
    if (scraperResult.errors.length > 0) {
      errors.push(`Scraper issues: ${scraperResult.errors.slice(0, 5).join(', ')}`)
    }
  } catch (err) {
    errors.push(`Scraper error: ${String(err).slice(0, 100)}`)
  }

  // Step 2: Use Claude AI for any fighters the scraper missed
  const stillMissing = [...allNamesNeeding].filter(name => !urls[name])
  if (stillMissing.length > 0) {
    try {
      const aiUrls = await lookupSherdogUrlsWithAI(stillMissing)
      const aiFound = Object.keys(aiUrls).length
      errors.push(`AI fallback: found ${aiFound}/${stillMissing.length}`)
      Object.assign(urls, aiUrls)
    } catch (err) {
      errors.push(`AI fallback error: ${String(err).slice(0, 150)}`)
    }
  }

  // Step 3: Update all fights with resolved URLs
  for (const fight of fights) {
    const update: Record<string, string> = {}
    if (fight.red_sherdog_url?.includes('fightfinder') && urls[fight.red_name]) {
      update.red_sherdog_url = urls[fight.red_name]
    }
    if (fight.blue_sherdog_url?.includes('fightfinder') && urls[fight.blue_name]) {
      update.blue_sherdog_url = urls[fight.blue_name]
    }

    if (Object.keys(update).length > 0) {
      await adminClient.from('fights').update(update).eq('id', fight.id)
      totalUpdated++
    }
  }

  // Count remaining
  const { count } = await adminClient
    .from('fights')
    .select('id', { count: 'exact', head: true })
    .or('red_sherdog_url.like.%fightfinder%,blue_sherdog_url.like.%fightfinder%')

  revalidatePath('/admin', 'layout')
  revalidatePath('/leagues', 'layout')

  return {
    success: true,
    updated: totalUpdated,
    remaining: count ?? 0,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  }
}

// ─── Manual Claude check ───────────────────────────────────────────────────────

export interface ClaudeCheckResult {
  eventName: string
  fightsChecked: number
  corrections: { fightId: string; fighterNames: string; from: string; to: string }[]
  ranAt: string
}

export async function runClaudeCheck(): Promise<ClaudeCheckResult> {
  await requireAdmin()
  const adminClient = createAdminClient()

  // Find the live event, or fall back to most recently updated completed event
  const { data: liveEvents } = await adminClient
    .from('events')
    .select('id, name')
    .eq('status', 'live')
    .order('start_time', { ascending: false })
    .limit(1)

  let targetEvent = liveEvents?.[0] ?? null

  if (!targetEvent) {
    const { data: recent } = await adminClient
      .from('events')
      .select('id, name')
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
    targetEvent = recent?.[0] ?? null
  }

  if (!targetEvent) throw new Error('No live or recent event found')

  const { data: fights } = await adminClient
    .from('fights')
    .select('id, red_name, blue_name, result_winner, result_method, status')
    .eq('event_id', targetEvent.id)
    .in('status', ['final', 'scheduled'])

  if (!fights || fights.length === 0) throw new Error('No fights found for event')

  const claudeResults = await fetchFightResultsWithClaude(
    targetEvent.name,
    fights.map(f => ({ id: f.id, redName: f.red_name, blueName: f.blue_name }))
  )

  const corrections: ClaudeCheckResult['corrections'] = []

  for (const match of claudeResults) {
    if (match.confidence !== 'high' || !match.winner || !match.method) continue
    const dbFight = fights.find(f => f.id === match.fightId)
    if (!dbFight) continue

    if (match.winner !== dbFight.result_winner || match.method !== dbFight.result_method) {
      const correctedRound = (match.method === 'ko_tko' || match.method === 'submission')
        ? (match.round ?? null) : null
      const { error } = await adminClient.from('fights').update({
        result_winner: match.winner,
        result_method: match.method,
        result_round: correctedRound,
        status: 'final',
      }).eq('id', match.fightId)
      if (!error) {
        corrections.push({
          fightId: match.fightId,
          fighterNames: `${dbFight.red_name} vs ${dbFight.blue_name}`,
          from: `${dbFight.result_winner ?? 'none'}/${dbFight.result_method ?? 'none'}`,
          to: `${match.winner}/${match.method}`,
        })
      }
    }
  }

  if (corrections.length > 0) {
    await adminClient.rpc('recalculate_event_picks', { p_event_id: targetEvent.id })
  }

  await adminClient.from('api_sync_log').insert({
    sync_type: 'validation',
    event_id: targetEvent.id,
    api_source: 'claude',
    status: corrections.length > 0 ? 'warning' : 'success',
    request_count: 1,
    details: { manual: true, fightsChecked: fights.length, corrections },
  })

  return {
    eventName: targetEvent.name,
    fightsChecked: fights.length,
    corrections,
    ranAt: new Date().toISOString(),
  }
}

export interface SyncCardsResult {
  eventsProcessed: number
  warnings: number
  ranAt: string
}

export async function runSyncCards(): Promise<SyncCardsResult> {
  await requireAdmin()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/cron/sync-cards`, {
    method: 'GET',
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Sync failed: HTTP ${res.status}`)
  }

  const data = await res.json()
  const results: { warnings: number }[] = data.results ?? []
  return {
    eventsProcessed: results.length,
    warnings: results.reduce((sum, r) => sum + (r.warnings ?? 0), 0),
    ranAt: new Date().toISOString(),
  }
}
