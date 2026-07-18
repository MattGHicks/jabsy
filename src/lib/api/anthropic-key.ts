import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Resolve the Anthropic API key.
 *
 * process.env.ANTHROPIC_API_KEY may be present but empty if the shell sets it
 * to "" (e.g. from Claude Code), which shadows the .env.local value Next.js
 * would otherwise load. Fall back to reading .env.local directly.
 */
export function getAnthropicKey(): string | null {
  const envKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (envKey) return envKey

  try {
    const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf-8')
    const match = envFile.match(/^ANTHROPIC_API_KEY=(.+)$/m)
    if (match?.[1]?.trim()) return match[1].trim()
  } catch { /* file not found in production — that's fine */ }

  return null
}
