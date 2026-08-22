import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicKey } from './anthropic-key'

function getApiKey(): string {
  const key = getAnthropicKey()
  if (!key) {
    throw new Error('ANTHROPIC_API_KEY not set. Add it to .env.local (local) or Vercel Environment Variables (prod).')
  }
  return key
}

function getClient() {
  return new Anthropic({ apiKey: getApiKey() })
}

export interface ClaudeEventResult {
  name: string
  date: string // ISO or human-readable
  venue: string | null
  fightCount: number | null
  mainEvent: string | null
  fights: { red: string; blue: string; weightClass: string | null }[]
}

/**
 * Use Claude AI with web search to find upcoming UFC events.
 * Returns a structured list of upcoming events found from multiple web sources,
 * including fight card data (fighters and weight classes).
 */
export async function searchUpcomingUFCEvents(): Promise<ClaudeEventResult[]> {
  const today = new Date().toISOString().split('T')[0]

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 3,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Today is ${today}. Find all upcoming UFC events in the next 90 days. For each event, provide: the full event name, date, venue/location, approximate number of fights, the main event matchup, AND a list of confirmed fights with each fighter's full name and weight class.

Search for "upcoming UFC events schedule fight card 2026" to find the latest information.

Return your response as a JSON array with this exact format (no markdown, just pure JSON):
[
  {
    "name": "UFC 326: Fighter vs Fighter",
    "date": "2026-03-08",
    "venue": "T-Mobile Arena, Las Vegas, NV",
    "fightCount": 14,
    "mainEvent": "Max Holloway vs Charles Oliveira",
    "fights": [
      { "red": "Max Holloway", "blue": "Charles Oliveira", "weightClass": "Lightweight" },
      { "red": "Sean O'Malley", "blue": "Merab Dvalishvili", "weightClass": "Bantamweight" }
    ]
  }
]

Only include events that haven't happened yet. Include as many confirmed fights per event as you can find. Return ONLY the JSON array, no other text.`,
      },
    ],
  })

  // Extract text content from response
  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  )

  if (!textBlock) return []

  try {
    // Parse JSON from response (strip markdown code fences if present)
    let jsonStr = textBlock.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    const events: ClaudeEventResult[] = JSON.parse(jsonStr)
    // Ensure fights array exists on each event
    return events.map(e => ({ ...e, fights: e.fights ?? [] }))
  } catch {
    console.error('Failed to parse Claude response:', textBlock.text)
    return []
  }
}

/**
 * Use Claude to validate event data against web sources.
 * Useful for cross-referencing ESPN data during daily sync.
 */
export async function validateEventData(eventName: string, fights: { red: string; blue: string }[]): Promise<{
  valid: boolean
  issues: string[]
}> {
  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 2,
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Verify this UFC event fight card is accurate by searching the web:

Event: ${eventName}
Fights:
${fights.map((f, i) => `${i + 1}. ${f.red} vs ${f.blue}`).join('\n')}

Return a JSON object with:
{
  "valid": true/false,
  "issues": ["any issues found, like wrong matchups or cancelled fights"]
}

Return ONLY the JSON, no other text.`,
      },
    ],
  })

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  )

  if (!textBlock) return { valid: true, issues: [] }

  try {
    let jsonStr = textBlock.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    return JSON.parse(jsonStr)
  } catch {
    return { valid: true, issues: [] }
  }
}

/**
 * Use Claude AI with web search to find exact Sherdog profile URLs for fighters
 * that the direct scraper couldn't resolve (name mismatches, special characters, etc.).
 * Batches up to ~10 fighters per call to stay efficient.
 */
export async function lookupSherdogUrlsWithAI(fighterNames: string[]): Promise<Record<string, string>> {
  if (fighterNames.length === 0) return {}

  const allResults: Record<string, string> = {}
  const client = getClient()

  // Batch into groups of 5 so each batch gets enough web searches
  const batchSize = 5
  for (let i = 0; i < fighterNames.length; i += batchSize) {
    const batch = fighterNames.slice(i, i + batchSize)

    try {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: batch.length + 2,
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Find the exact Sherdog fighter profile URL for each of these MMA fighters. Sherdog URLs follow the format: https://www.sherdog.com/fighter/Firstname-Lastname-12345

Note: Some names may have special characters (accents, diacritics) or unusual spacing that differs between ESPN and Sherdog. Search Sherdog to find the correct profile.

Fighters to look up:
${batch.map((n, j) => `${j + 1}. ${n}`).join('\n')}

Return a JSON object mapping each fighter name (exactly as given above) to their Sherdog profile URL. If a fighter genuinely has no Sherdog profile, map them to null.

Return ONLY the JSON object, no other text.`,
          },
        ],
      })

      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      )

      if (!textBlock) continue

      let jsonStr = textBlock.text.trim()
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      const parsed: Record<string, string | null> = JSON.parse(jsonStr)
      for (const [name, url] of Object.entries(parsed)) {
        if (!url || !url.includes('sherdog.com/fighter/')) continue
        // Reject URLs that don't belong to the fighter asked for. Batched
        // lookups have previously returned another fighter from the same batch,
        // which shows up as two fighters with each other's profile linked.
        if (!sherdogUrlMatchesName(url, name)) {
          console.warn(`Sherdog AI lookup returned mismatched URL for ${name}: ${url}`)
          continue
        }
        allResults[name] = url
      }
    } catch {
      // Continue with remaining batches even if one fails
    }
  }

  return allResults
}

// ─── Tier 3: Claude fight results fallback ────────────────────────────────────

export interface ClaudeFightResult {
  fightId: string
  redName: string
  blueName: string
  winner: 'red' | 'blue' | 'draw' | 'nc' | null
  method: 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc' | null
  round: number | null
  confidence: 'high' | 'low'
}

/**
 * Use Claude web_search to find fight results when both ESPN and UFC APIs have failed.
 * Batches all pending fights into a single call for efficiency.
 * Rate limiting (max once per event per 3 minutes) is enforced by the caller.
 * Only results with confidence='high' should be written to the DB.
 */
export async function fetchFightResultsWithClaude(
  eventName: string,
  pendingFights: { id: string; redName: string; blueName: string }[]
): Promise<ClaudeFightResult[]> {
  if (pendingFights.length === 0) return []

  const today = new Date().toISOString().split('T')[0]

  const response = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: Math.min(pendingFights.length + 2, 5),
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Today is ${today}. I need the official results for fights that just happened or are happening now at ${eventName}.

For each fight below, search the web for the result and return it.

Fights to look up:
${pendingFights.map((f, i) => `${i + 1}. [id:${f.id}] ${f.redName} vs ${f.blueName}`).join('\n')}

For each fight you find a result for, return:
- fightId: the exact id string shown in brackets above
- redName / blueName: exactly as given above
- winner: "red" (${pendingFights[0]?.redName ?? 'red corner'} won), "blue" (${pendingFights[0]?.blueName ?? 'blue corner'} won), "draw", "nc", or null if unknown
- method: "decision", "ko_tko", "submission", "dq", "nc", or null if unknown
- round: integer (1-5) for ko_tko or submission finishes only, null for decisions or unknown
- confidence: "high" if you found a clear reliable source, "low" if uncertain or no result found yet

Only include fights you found results for. If a fight hasn't happened yet or you can't find a result, omit it entirely.

Return ONLY a JSON array, no other text:
[{ "fightId": "...", "redName": "...", "blueName": "...", "winner": "red", "method": "ko_tko", "round": 2, "confidence": "high" }]`,
      },
    ],
  })

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  )
  if (!textBlock) return []

  try {
    let jsonStr = textBlock.text.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }
    const results: ClaudeFightResult[] = JSON.parse(jsonStr)
    // Validate fightIds match what we sent — ignore any Claude hallucinated
    const validIds = new Set(pendingFights.map(f => f.id))
    return results.filter(r => validIds.has(r.fightId))
  } catch {
    console.error('Failed to parse Claude fight results:', textBlock.text)
    return []
  }
}

/**
 * Use Claude Haiku with web search to find the UFC CloudFront event fmid
 * for an event. Falls back to this when direct UFC.com page scraping fails
 * (e.g. page not yet published or fmid not yet embedded in HTML).
 * Returns the numeric fmid string, or null if not found.
 */
export async function findUfcEventFmidWithClaude(eventName: string, eventSlug: string): Promise<string | null> {
  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{
        role: 'user',
        content: `I need the UFC CloudFront API event ID (called "event_fmid") for "${eventName}".

Fetch this page and look for "event_fmid" in the HTML source:
https://www.ufc.com/event/${eventSlug}

The fmid is a numeric string embedded in the page like: "event_fmid":"600057365"

If you can't find it there, search for: UFC "${eventName}" event_fmid

Return ONLY the numeric fmid (e.g. 600057365), or the word null if you cannot find it. No other text.`,
      }],
    })

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    )
    if (!textBlock) return null

    const text = textBlock.text.trim()
    if (text === 'null' || !text) return null
    // Extract numeric ID — fmids are positive integers (e.g. 1301)
    const match = text.match(/\b(\d+)\b/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

interface SherdogSearchHit {
  firstname?: string
  lastname?: string
  url?: string
}

const normalizeName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * How confidently a Sherdog profile URL can be tied to a fighter's name.
 *
 * - `match`    the slug is this fighter, allowing for spelling variation
 * - `partial`  shares part of the name — usually a ring name over a legal name
 *              ("King Green" is Bobby Green, "Renato Moicano" is Renato
 *              Carneiro), but also how a wrong same-surname fighter looks
 *              ("Tim Elliott" pointing at Oban Elliott). Needs human eyes.
 * - `mismatch` nothing in common; the link is wrong
 *
 * Used strictly when picking a search result (only `match` is accepted, since a
 * wrong pick means a wrong link) and leniently when auditing links we already
 * have (where `partial` is a review queue, not an error).
 */
export type SherdogUrlVerdict = 'match' | 'partial' | 'mismatch'

export function classifySherdogUrl(url: string, name: string): SherdogUrlVerdict {
  const slug = url.match(/\/fighter\/(.+?)-\d+$/)?.[1]
  if (!slug) return 'mismatch'

  const slugTokens = normalizeName(slug.replace(/-/g, ' ')).split(' ').filter(Boolean)
  const nameTokens = normalizeName(name).split(' ').filter(Boolean)
  if (slugTokens.length === 0 || nameTokens.length === 0) return 'mismatch'

  if (isSameFighter(slugTokens, nameTokens)) return 'match'

  // Any shared name part means it's plausibly the same person under a different
  // name, rather than a mix-up with an unrelated fighter.
  const nameSet = new Set(nameTokens)
  return slugTokens.some((t) => nameSet.has(t)) ? 'partial' : 'mismatch'
}

/**
 * Strict check used when accepting a candidate from search or from the AI
 * fallback. Only a verified match passes.
 */
export function sherdogUrlMatchesName(url: string, name: string): boolean {
  return classifySherdogUrl(url, name) === 'match'
}

function isSameFighter(slugTokens: string[], nameTokens: string[]): boolean {

  // Compare letters only, ignoring where the word breaks fall. Sherdog splits
  // names differently ("Dooho Choi" → "Doo-Ho-Choi", "Waldo Cortes Acosta" →
  // "Waldo-CortesAcosta", "Sumudaerji" → "Su-Mudaerji").
  const slugLetters = slugTokens.join('')
  const nameLetters = nameTokens.join('')
  if (slugLetters === nameLetters) return true

  // Same letters in a different order ("Aoriqileng" → "Qileng-Aori").
  if ([...slugTokens].sort().join('') === [...nameTokens].sort().join('')) return true

  // Tolerate transliteration drift ("Daria Zhelezniakova" vs
  // "Darya-Zheleznyakova") — a few characters over a long name is a spelling
  // variant, not a different fighter.
  const maxLen = Math.max(slugLetters.length, nameLetters.length)
  if (levenshtein(slugLetters, nameLetters) <= Math.floor(maxLen * 0.15)) return true

  // Sherdog carries the fuller legal name ("Jose Delano" → "Jose Delano Viana
  // Rodrigues"). Accept only when our name is a leading run of the slug —
  // matching scattered tokens would let "Felipe Franco" claim
  // "Fabio Felipe Barbosa Franco", a different fighter.
  if (slugTokens.length <= nameTokens.length) return false
  return slugTokens.slice(0, nameTokens.length).join('') === nameLetters
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = curr
  }
  return prev[b.length]
}

/**
 * Query Sherdog's fighter search JSON endpoint — the same one their own search
 * box uses. The HTML page at /stats/fightfinder?SearchTxt=... stopped
 * server-rendering results, so scraping it always came back empty.
 */
async function querySherdogSearch(term: string): Promise<SherdogSearchHit[]> {
  const response = await fetch(`https://www.sherdog.com/search/fightfinder/?q=${encodeURIComponent(term)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json,text/javascript,*/*;q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const json = await response.json()
  return Array.isArray(json?.collection) ? json.collection : []
}

/**
 * Build the search terms to try for a fighter, cheapest and most likely first.
 *
 * Sherdog's search matches literally against how *they* split a name, which
 * often differs from ESPN's spelling — most commonly for Korean and Chinese
 * fighters, where ESPN runs the given name together and Sherdog splits it
 * ("Seokhyeon Ko" is "Seok Hyeon Ko", "JunYong Park" is "Jun Yong Park").
 * Since it matches on token prefixes, searching the surname plus the first few
 * letters of the given name finds these even when we can't guess the split.
 *
 * Common names hit on the first term, so this costs one request in the normal
 * case and only fans out for the awkward ones.
 */
function sherdogSearchTerms(name: string): string[] {
  const terms = [name]
  const push = (t: string) => { if (t && !terms.includes(t)) terms.push(t) }
  const tokens = name.split(/\s+/).filter(Boolean)

  push(name.replace(/\s+(jr\.?|sr\.?|i{2,3}|iv)$/i, '').trim())

  // "JunYong Park" → "Jun Yong Park"
  push(tokens.map((t) => t.replace(/(?<=[a-z])(?=[A-Z])/g, ' ')).join(' '))

  // "RJ Harris" → "R.J. Harris"
  const initials = name.match(/^([A-Z])([A-Z])\s+(.+)$/)
  if (initials) push(`${initials[1]}.${initials[2]}. ${initials[3]}`)

  if (tokens.length >= 2) {
    // Surname plus a prefix of the given name, which survives any split point.
    const [first, last] = [tokens[0], tokens[tokens.length - 1]]
    for (const len of [4, 3, 2, 5]) {
      if (first.length > len) push(`${last} ${first.slice(0, len)}`)
    }
  } else {
    // Single run-together token ("Sumudaerji" is "Su Mudaerji"): we don't know
    // where it splits, so try each side as a prefix.
    for (const cut of [4, 5]) if (name.length > cut + 2) push(name.slice(0, cut))
    for (const cut of [2, 3, 4]) if (name.length > cut + 3) push(name.slice(cut))
  }

  return terms
}

/**
 * Look up exact Sherdog profile URLs via Sherdog's own search API.
 * No AI needed. Returns a map of fighter name → Sherdog profile URL.
 */
export async function lookupSherdogUrls(fighterNames: string[]): Promise<{ results: Record<string, string>; errors: string[] }> {
  if (fighterNames.length === 0) return { results: {}, errors: [] }

  const results: Record<string, string> = {}
  const errors: string[] = []

  for (const name of fighterNames) {
    try {
      let matched: string | null = null
      let ambiguous = 0

      for (const term of sherdogSearchTerms(name)) {
        const hits = await querySherdogSearch(term)
        // Small delay to be respectful to Sherdog's servers
        await new Promise(resolve => setTimeout(resolve, 300))

        // Only accept hits whose profile URL verifiably belongs to this
        // fighter — the same check applied to AI results. Looser terms return
        // plenty of same-surname fighters, and picking one of those is worse
        // than returning nothing.
        const candidates = [...new Set(
          hits.filter((h) => h.url && sherdogUrlMatchesName(h.url, name)).map((h) => h.url!),
        )]

        if (candidates.length === 1) { matched = candidates[0]; break }
        if (candidates.length > 1) {
          // Sherdog carries several fighters under the same name (three Levi
          // Rodrigueses, six Jose Delgados). Nothing here distinguishes them,
          // so leave it for the AI fallback rather than link the wrong man.
          ambiguous = candidates.length
          break
        }
      }

      if (matched) {
        results[name] = `https://www.sherdog.com${matched}`
      } else if (ambiguous) {
        errors.push(`${name}: ambiguous (${ambiguous} fighters share this name)`)
      } else {
        errors.push(`${name}: no match`)
      }
    } catch (err) {
      errors.push(`${name}: ${String(err).slice(0, 80)}`)
    }
  }

  return { results, errors }
}
