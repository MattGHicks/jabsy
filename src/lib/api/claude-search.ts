import Anthropic from '@anthropic-ai/sdk'
import type { MappedEvent } from './types'

const client = new Anthropic()

interface ClaudeEventResult {
  name: string
  date: string // ISO or human-readable
  venue: string | null
  fightCount: number | null
  mainEvent: string | null
}

/**
 * Use Claude AI with web search to find upcoming UFC events.
 * Returns a structured list of upcoming events found from multiple web sources.
 */
export async function searchUpcomingUFCEvents(): Promise<ClaudeEventResult[]> {
  const today = new Date().toISOString().split('T')[0]

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
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
        content: `Today is ${today}. Find all upcoming UFC events in the next 90 days. For each event, provide: the full event name, date, venue/location, approximate number of fights, and the main event matchup.

Search for "upcoming UFC events schedule 2026" to find the latest information.

Return your response as a JSON array with this exact format (no markdown, just pure JSON):
[
  {
    "name": "UFC 326: Fighter vs Fighter",
    "date": "2026-03-08",
    "venue": "T-Mobile Arena, Las Vegas, NV",
    "fightCount": 14,
    "mainEvent": "Max Holloway vs Charles Oliveira"
  }
]

Only include events that haven't happened yet. Return ONLY the JSON array, no other text.`,
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
    return events
  } catch {
    console.error('Failed to parse Claude response:', textBlock.text)
    return []
  }
}

/**
 * Use Claude to validate event data against web sources.
 * Useful for cross-referencing ESPN data.
 */
export async function validateEventData(eventName: string, fights: { red: string; blue: string }[]): Promise<{
  valid: boolean
  issues: string[]
}> {
  const response = await client.messages.create({
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
