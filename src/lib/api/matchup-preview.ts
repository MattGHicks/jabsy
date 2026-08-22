import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getAnthropicKey } from './anthropic-key'

type AdminClient = SupabaseClient<Database>

const PROMPT_PREFIX = `You are an MMA expert writing a brief preview snippet for a fantasy picks app. Write 2-3 sentences (max 60 words) describing what to watch for in this matchup. Mention each fighter's notable strength or style if you know it. DO NOT predict a winner. DO NOT use emoji. Plain prose only.`

/**
 * Generate a 2-3 sentence matchup preview via Claude. Returns null on failure.
 * Caller is responsible for caching the result in the fights table.
 */
export async function generateMatchupPreview(opts: {
  redName: string
  redRecord: string | null
  blueName: string
  blueRecord: string | null
  weightClass: string | null
  scheduledRounds: number
  isMainEvent: boolean
}): Promise<string | null> {
  const apiKey = getAnthropicKey()
  if (!apiKey) {
    console.error('matchup preview skipped: ANTHROPIC_API_KEY not set')
    return null
  }

  const prompt = `${PROMPT_PREFIX}

Matchup:
- ${opts.redName} (${opts.redRecord ?? 'record unknown'}) vs ${opts.blueName} (${opts.blueRecord ?? 'record unknown'})
- Weight class: ${opts.weightClass ?? 'unknown'}
${opts.isMainEvent ? '- This is the main event' : ''}
- Scheduled for ${opts.scheduledRounds} rounds

Preview:`

  try {
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const preview = message.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    return preview || null
  } catch (err) {
    console.error('matchup preview generation failed:', err)
    return null
  }
}

/**
 * Pre-warm matchup previews for every scheduled fight in the given event(s)
 * that doesn't already have one cached. Called from the daily card-sync cron
 * so users never have to wait for first-click generation.
 *
 * Returns count of previews generated. Errors are swallowed per-fight so one
 * bad call doesn't block the rest. Throttled by a small delay between calls.
 */
export async function prewarmMatchupPreviews(
  adminClient: AdminClient,
  eventId: string,
): Promise<{ generated: number; skipped: number; failed: number }> {
  const { data: fights, error } = await adminClient
    .from('fights')
    .select('id, red_name, red_record, blue_name, blue_record, weight_class, scheduled_rounds, is_main_event, matchup_preview, status')
    .eq('event_id', eventId)
    .eq('status', 'scheduled')
    .is('matchup_preview', null)

  if (error || !fights) return { generated: 0, skipped: 0, failed: 0 }

  let generated = 0
  let failed = 0

  for (const fight of fights) {
    const preview = await generateMatchupPreview({
      redName: fight.red_name,
      redRecord: fight.red_record,
      blueName: fight.blue_name,
      blueRecord: fight.blue_record,
      weightClass: fight.weight_class,
      scheduledRounds: fight.scheduled_rounds,
      isMainEvent: fight.is_main_event,
    })

    if (!preview) {
      failed++
      continue
    }

    const { error: updateErr } = await adminClient
      .from('fights')
      .update({
        matchup_preview: preview,
        matchup_preview_generated_at: new Date().toISOString(),
      })
      .eq('id', fight.id)

    if (updateErr) {
      failed++
      continue
    }

    generated++
    // Small jitter to avoid hammering the API.
    await new Promise((r) => setTimeout(r, 250))
  }

  return { generated, skipped: 0, failed }
}
