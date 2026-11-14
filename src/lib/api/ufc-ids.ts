import type { createAdminClient } from '@/lib/supabase/admin'
import { fetchUfcEventSummary, fetchUfcLiveEvent, type UfcLiveFight } from './ufc'
import { findUfcEventFmidWithClaude } from './claude-search'
import { alignUfcFight } from './results'

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Populate the UFC stats-feed IDs for an event: `ufc_event_fmid` on the event
 * and `ufc_fight_id` on each fight. Without them the UFC fallback tier and the
 * result verifier have no official record to check against.
 *
 * fmid lookup order: UFC.com event page → probe fmids near the ones we already
 * know (matching on date + headliner names) → Claude web search.
 * Safe to call repeatedly — skips anything already populated.
 */
export async function syncUfcIds(
  adminClient: AdminClient,
  event: { id: string; name: string; ufc_event_fmid: string | null; start_time: string },
  opts: { allowClaude?: boolean } = {}
): Promise<string | null> {
  let fmid = event.ufc_event_fmid
  let ufcFights: UfcLiveFight[] | null = null

  if (!fmid) {
    const slug = eventNameToSlug(event.name)
    try {
      const res = await fetch(`https://www.ufc.com/event/${slug}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      })
      if (res.ok) {
        const match = (await res.text()).match(/"event_fmid"\s*:\s*"(\d+)"/)
        if (match?.[1]) fmid = match[1]
      }
    } catch { /* fall through to probing */ }

    if (!fmid) {
      const probed = await probeFmid(adminClient, event)
      if (probed) {
        fmid = probed.fmid
        ufcFights = probed.fights
      }
    }

    if (!fmid && opts.allowClaude !== false) {
      fmid = await findUfcEventFmidWithClaude(event.name, slug)
    }

    if (!fmid) return null
    await adminClient.from('events').update({ ufc_event_fmid: fmid }).eq('id', event.id)
  }

  ufcFights ??= await fetchUfcLiveEvent(fmid)
  if (!ufcFights) return fmid

  const { data: dbFights } = await adminClient
    .from('fights')
    .select('id, red_name, blue_name, ufc_fight_id')
    .eq('event_id', event.id)

  for (const dbFight of dbFights ?? []) {
    if (dbFight.ufc_fight_id) continue
    const match = ufcFights.find(uf => alignUfcFight(uf, dbFight.red_name, dbFight.blue_name))
    if (match) {
      await adminClient.from('fights').update({ ufc_fight_id: match.fightId }).eq('id', dbFight.id)
    }
  }

  return fmid
}

/**
 * fmids are allocated when the UFC announces a card, not in date order, so
 * "last event + 1" misses. Scan a window around the highest fmid we know and
 * take the one whose date and headliners match.
 */
async function probeFmid(
  adminClient: AdminClient,
  event: { name: string; start_time: string }
): Promise<{ fmid: string; fights: UfcLiveFight[] } | null> {
  const { data: known } = await adminClient
    .from('events')
    .select('ufc_event_fmid')
    .not('ufc_event_fmid', 'is', null)

  const ids = (known ?? []).map(e => parseInt(e.ufc_event_fmid!, 10)).filter(Number.isFinite)
  if (ids.length === 0) return null
  const taken = new Set(ids)
  const max = Math.max(...ids)

  const candidates: number[] = []
  for (let id = max - 20; id <= max + 30; id++) if (!taken.has(id)) candidates.push(id)

  const eventTime = new Date(event.start_time).getTime()
  const eventName = normalize(event.name)

  for (let i = 0; i < candidates.length; i += 10) {
    const batch = await Promise.all(
      candidates.slice(i, i + 10).map(id => fetchUfcEventSummary(String(id)).catch(() => null))
    )
    const hit = batch.find(summary => {
      if (!summary) return false
      const withinADay = Math.abs(new Date(summary.startTime).getTime() - eventTime) < 36 * 3600 * 1000
      if (!withinADay) return false
      const headliner = summary.fights[0]
      return [headliner?.redName, headliner?.blueName].some(n => n && eventName.includes(lastName(n)))
    })
    if (hit) return { fmid: hit.fmid, fights: hit.fights }
  }
  return null
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+jr\.?$/, '').trim()
}

function lastName(name: string): string {
  return normalize(name).split(/\s+/).pop() ?? ''
}

/**
 * Convert an event name like "UFC Fight Night: Emmett vs. Vallejos"
 * to a UFC.com URL slug like "ufc-fight-night-emmett-vs-vallejos".
 */
export function eventNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}
