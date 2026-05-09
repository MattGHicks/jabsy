'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateMatchupPreview } from '@/lib/api/matchup-preview'

export type MatchupInfo = {
  redName: string
  redRecord: string | null
  redSherdogUrl: string | null
  blueName: string
  blueRecord: string | null
  blueSherdogUrl: string | null
  weightClass: string | null
  scheduledRounds: number
  isMainEvent: boolean
  preview: string | null
}

/**
 * Lazy-load the matchup preview for a fight. Returns the cached value if it
 * exists; otherwise calls Claude to generate one and caches it for next time.
 *
 * In normal operation, the daily card-sync cron pre-warms every fight's
 * preview, so first-click latency only happens for fights added after the
 * most recent sync.
 */
export async function getMatchupPreview(fightId: string): Promise<{ info?: MatchupInfo; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: fight, error: fetchErr } = await supabase
    .from('fights')
    .select('id, red_name, red_record, red_sherdog_url, blue_name, blue_record, blue_sherdog_url, weight_class, scheduled_rounds, is_main_event, matchup_preview, status')
    .eq('id', fightId)
    .single()

  if (fetchErr || !fight) return { error: 'Fight not found' }

  const baseInfo: MatchupInfo = {
    redName: fight.red_name,
    redRecord: fight.red_record,
    redSherdogUrl: fight.red_sherdog_url,
    blueName: fight.blue_name,
    blueRecord: fight.blue_record,
    blueSherdogUrl: fight.blue_sherdog_url,
    weightClass: fight.weight_class,
    scheduledRounds: fight.scheduled_rounds,
    isMainEvent: fight.is_main_event,
    preview: fight.matchup_preview,
  }

  // Already cached, or fight is over (preview cleared by trigger when result set) — return as-is.
  const isFinished = fight.status === 'final' || fight.status === 'no_contest'
  if (fight.matchup_preview || isFinished) return { info: baseInfo }

  const preview = await generateMatchupPreview({
    redName: fight.red_name,
    redRecord: fight.red_record,
    blueName: fight.blue_name,
    blueRecord: fight.blue_record,
    weightClass: fight.weight_class,
    scheduledRounds: fight.scheduled_rounds,
    isMainEvent: fight.is_main_event,
  })

  if (!preview) return { info: baseInfo }

  const adminClient = createAdminClient()
  await adminClient
    .from('fights')
    .update({
      matchup_preview: preview,
      matchup_preview_generated_at: new Date().toISOString(),
    })
    .eq('id', fightId)

  return { info: { ...baseInfo, preview } }
}
