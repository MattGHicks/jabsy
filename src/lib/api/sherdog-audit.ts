import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { classifySherdogUrl } from './claude-search'

type AdminClient = SupabaseClient<Database>

export type SherdogLinkProblem = 'mismatch' | 'unresolved' | 'missing' | 'review'

export interface SherdogLinkIssue {
  fightId: string
  eventName: string
  eventStatus: string
  fighterName: string
  corner: 'red' | 'blue'
  url: string | null
  problem: SherdogLinkProblem
}

export interface SherdogAuditResult {
  checked: number
  issues: SherdogLinkIssue[]
}

// Worst first. A link that goes to the wrong fighter is more damaging than a
// missing one, because it looks like it works.
const PROBLEM_RANK: Record<SherdogLinkProblem, number> = {
  mismatch: 0,
  unresolved: 1,
  missing: 2,
  review: 3,
}

/**
 * Audit fighters' Sherdog links and report anything that isn't a verified
 * profile URL.
 *
 * This exists because the failure mode is invisible from the app: a link
 * renders normally whether or not it points at the right fighter. Every problem
 * we've hit — search-page placeholders that never resolved, and lookups that
 * returned another fighter from the same batch — is caught here.
 *
 * Pure string work over rows already in the database, so it's cheap enough to
 * run on every card sync.
 */
export async function auditSherdogLinks(
  adminClient: AdminClient,
  opts: { upcomingOnly?: boolean } = {},
): Promise<SherdogAuditResult> {
  const query = adminClient
    .from('fights')
    .select('id, red_name, red_sherdog_url, blue_name, blue_sherdog_url, events!inner(name, status)')
    .neq('status', 'cancelled')

  if (opts.upcomingOnly) query.eq('events.status', 'upcoming')

  const { data: fights, error } = await query
  if (error || !fights) return { checked: 0, issues: [] }

  const issues: SherdogLinkIssue[] = []
  let checked = 0

  for (const fight of fights) {
    const event = fight.events as unknown as { name: string; status: string } | null

    for (const corner of ['red', 'blue'] as const) {
      const fighterName = corner === 'red' ? fight.red_name : fight.blue_name
      const url = corner === 'red' ? fight.red_sherdog_url : fight.blue_sherdog_url
      checked++

      const problem = classifyLink(url, fighterName)
      if (!problem) continue

      issues.push({
        fightId: fight.id,
        eventName: event?.name ?? 'Unknown event',
        eventStatus: event?.status ?? 'unknown',
        fighterName,
        corner,
        url,
        problem,
      })
    }
  }

  issues.sort((a, b) =>
    PROBLEM_RANK[a.problem] - PROBLEM_RANK[b.problem] ||
    Number(b.eventStatus === 'upcoming') - Number(a.eventStatus === 'upcoming') ||
    a.eventName.localeCompare(b.eventName),
  )

  return { checked, issues }
}

function classifyLink(url: string | null, fighterName: string): SherdogLinkProblem | null {
  if (!url) return 'missing'
  // Still the placeholder written at sync time, never resolved to a profile.
  if (!url.includes('/fighter/')) return 'unresolved'

  const verdict = classifySherdogUrl(url, fighterName)
  if (verdict === 'mismatch') return 'mismatch'
  // Shares part of the name — usually a ring name over a legal one ("King
  // Green" is Bobby Green), but a wrong same-surname link looks identical, so
  // it can't be auto-cleared.
  if (verdict === 'partial') return 'review'
  return null
}

/**
 * Problems worth acting on now, as opposed to the standing review queue of ring
 * names. Used to decide whether a sync should raise a warning.
 */
export function actionableIssues(issues: SherdogLinkIssue[]): SherdogLinkIssue[] {
  return issues.filter((i) => i.problem === 'mismatch' || i.problem === 'unresolved')
}
