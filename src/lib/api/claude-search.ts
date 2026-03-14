import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'
import { join } from 'path'

function getApiKey(): string {
  // process.env.ANTHROPIC_API_KEY may be empty if the shell sets it to ""
  // (e.g. from Claude Code), which prevents Next.js from loading .env.local value.
  const envKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (envKey) return envKey

  // Fallback: read directly from .env.local
  try {
    const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
    const match = envFile.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    if (match?.[1]?.trim()) return match[1].trim()
  } catch { /* file not found in production — that's fine */ }

  throw new Error('ANTHROPIC_API_KEY not set. Add it to .env.local (local) or Vercel Environment Variables (prod).')
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
        if (url && url.includes('sherdog.com/fighter/')) {
          allResults[name] = url
        }
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
 * Look up exact Sherdog profile URLs by scraping the Sherdog search page directly.
 * No AI needed — just fetches the fightfinder search results and extracts the first match.
 * Returns a map of fighter name → Sherdog profile URL.
 */
export async function lookupSherdogUrls(fighterNames: string[]): Promise<{ results: Record<string, string>; errors: string[] }> {
  if (fighterNames.length === 0) return { results: {}, errors: [] }

  const results: Record<string, string> = {}
  const errors: string[] = []

  for (const name of fighterNames) {
    try {
      const searchUrl = `https://www.sherdog.com/stats/fightfinder?SearchTxt=${encodeURIComponent(name)}`
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })

      if (!response.ok) {
        errors.push(`${name}: HTTP ${response.status}`)
        continue
      }

      const html = await response.text()

      // Check for Cloudflare challenge or empty response
      if (html.length < 500 || html.includes('cf-challenge') || html.includes('Just a moment')) {
        errors.push(`${name}: blocked by Cloudflare`)
        continue
      }

      // Match links: <a href="/fighter/Elijah-Smith-385324">Elijah Smith</a>
      const linkPattern = /<a\s+href="(\/fighter\/[^"]+)"[^>]*>([^<]+)<\/a>/g
      const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[.\-']/g, '').replace(/\s+/g, ' ')
      const targetName = normalize(name)
      const targetParts = targetName.split(' ')
      const targetLast = targetParts[targetParts.length - 1]

      let exactMatch: string | null = null
      let fuzzyMatch: string | null = null
      for (const m of html.matchAll(linkPattern)) {
        const linkText = normalize(m[2])
        // Exact match — best case
        if (linkText === targetName) { exactMatch = m[1]; break }
        // Fuzzy: Sherdog name starts with ESPN name (e.g. "Jose Delano" → "Jose Delano Viana Rodrigues")
        // or ESPN name's last name matches Sherdog's last name and first part overlaps
        if (!fuzzyMatch) {
          const linkParts = linkText.split(' ')
          const linkLast = linkParts[linkParts.length - 1]
          if (linkText.startsWith(targetName + ' ') || (targetLast === linkLast && linkText.includes(targetParts[0]))) {
            fuzzyMatch = m[1]
          }
        }
      }

      const matched = exactMatch ?? fuzzyMatch
      if (matched) {
        results[name] = `https://www.sherdog.com${matched}`
      } else {
        errors.push(`${name}: no match`)
      }

      // Small delay to be respectful to Sherdog's servers
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      errors.push(`${name}: ${String(err).slice(0, 80)}`)
    }
  }

  return { results, errors }
}
