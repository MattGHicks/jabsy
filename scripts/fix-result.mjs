#!/usr/bin/env node
/**
 * Manual result correction — the fallback for when the admin UI isn't handy
 * (phone, no laptop) or live-results has written something wrong.
 *
 * Does exactly what the admin panel's saveResult/clearResult do: writes the
 * result, then runs recalculate_event_picks so every league board reflects the
 * change immediately.
 *
 * Usage:
 *   node scripts/fix-result.mjs list
 *   node scripts/fix-result.mjs set  <bout_order> <red|blue|draw|nc> <ko_tko|submission|decision|dq|draw|nc> [round]
 *   node scripts/fix-result.mjs clear <bout_order>
 *
 * Examples:
 *   node scripts/fix-result.mjs set 1 red ko_tko 3
 *   node scripts/fix-result.mjs set 5 blue decision
 *   node scripts/fix-result.mjs clear 5
 *
 * Targets the soonest live/upcoming event by default; override with EVENT_ID=<uuid>.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

const WINNERS = ['red', 'blue', 'draw', 'nc']
const METHODS = ['ko_tko', 'submission', 'decision', 'dq', 'draw', 'nc']

async function resolveEvent() {
  if (process.env.EVENT_ID) {
    const { data } = await db.from('events').select('id, name, status').eq('id', process.env.EVENT_ID).single()
    return data
  }
  const { data } = await db.from('events')
    .select('id, name, status')
    .in('status', ['live', 'upcoming'])
    .order('start_time', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data
}

async function loadFights(eventId) {
  const { data } = await db.from('fights')
    .select('id, bout_order, red_name, blue_name, status, result_winner, result_method, result_round')
    .eq('event_id', eventId)
    .order('bout_order', { ascending: true })
  return data ?? []
}

function render(f) {
  const res = f.result_winner
    ? `${f.result_winner}/${f.result_method}${f.result_round ? ' R' + f.result_round : ''}`
    : '—'
  const who = f.result_winner === 'red' ? f.red_name : f.result_winner === 'blue' ? f.blue_name : ''
  return `#${String(f.bout_order).padStart(2)}  ${f.red_name} vs ${f.blue_name}\n      status=${f.status.padEnd(10)} result=${res} ${who && '(' + who + ')'}`
}

const [cmd, boutArg, winnerArg, methodArg, roundArg] = process.argv.slice(2)

const event = await resolveEvent()
if (!event) {
  console.error('No live/upcoming event found. Set EVENT_ID=<uuid> to target a specific one.')
  process.exit(1)
}
console.log(`Event: ${event.name}  (${event.status})\n`)

const fights = await loadFights(event.id)

if (!cmd || cmd === 'list') {
  fights.forEach(f => console.log(render(f)))
  process.exit(0)
}

const bout = Number(boutArg)
const fight = fights.find(f => f.bout_order === bout)
if (!fight) {
  console.error(`No fight with bout_order ${boutArg}. Run "list" to see them.`)
  process.exit(1)
}

if (cmd === 'clear') {
  console.log('BEFORE:\n' + render(fight))
  const { error } = await db.from('fights')
    .update({ result_winner: null, result_method: null, result_round: null, status: 'scheduled' })
    .eq('id', fight.id)
  if (error) { console.error('Update failed:', error.message); process.exit(1) }
} else if (cmd === 'set') {
  if (!WINNERS.includes(winnerArg)) {
    console.error(`winner must be one of: ${WINNERS.join(', ')}`); process.exit(1)
  }
  if (!METHODS.includes(methodArg)) {
    console.error(`method must be one of: ${METHODS.join(', ')}`); process.exit(1)
  }
  // Round only counts for finishes — decisions must not carry one, or the
  // round bonus scores against a fight that never had a finishing round.
  const isFinish = methodArg === 'ko_tko' || methodArg === 'submission'
  const round = isFinish && roundArg ? Number(roundArg) : null
  if (isFinish && !round) console.warn('! No round given for a finish — round points cannot be awarded.')

  const effectiveWinner = methodArg === 'draw' ? 'draw' : methodArg === 'nc' ? 'nc' : winnerArg

  console.log('BEFORE:\n' + render(fight))
  const { error } = await db.from('fights')
    .update({
      result_winner: effectiveWinner,
      result_method: methodArg,
      result_round: round,
      status: 'final',
    })
    .eq('id', fight.id)
  if (error) { console.error('Update failed:', error.message); process.exit(1) }
} else {
  console.error(`Unknown command "${cmd}". Use: list | set | clear`)
  process.exit(1)
}

// Same recalculation the admin actions run — without this the boards keep the old points.
const { error: rpcErr } = await db.rpc('recalculate_event_picks', { p_event_id: event.id })
if (rpcErr) {
  console.error('! Result written but recalculate_event_picks FAILED:', rpcErr.message)
  console.error('  Boards will be stale until it is re-run.')
  process.exit(1)
}

const updated = (await loadFights(event.id)).find(f => f.bout_order === bout)
console.log('\nAFTER:\n' + render(updated))
console.log('\nScores recalculated for the whole event.')
