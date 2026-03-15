import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Activity, Wifi, Bot, Zap, AlertTriangle, CheckCircle2, ShieldCheck, ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RefreshCountdown, RefreshTimestamp, ActivityFeed, SystemTestButton, ClaudeCheckButton } from './status-client'
import type { LogEntry } from './status-client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function StatusDot({ status }: { status: 'ok' | 'warning' | 'error' | 'idle' | 'unknown' }) {
  const colors = { ok: '#4ade80', warning: '#facc15', error: '#ef4444', idle: '#3f3f46', unknown: '#3f3f46' }
  const color = colors[status]
  return (
    <span
      className="w-2 h-2 rounded-full inline-block shrink-0"
      style={{
        backgroundColor: color,
        boxShadow: status === 'ok' ? `0 0 6px ${color}88` : 'none',
      }}
    />
  )
}

function StatusLabel({ status }: { status: 'ok' | 'warning' | 'error' | 'idle' | 'unknown' }) {
  const labels = { ok: 'HEALTHY', warning: 'DEGRADED', error: 'DOWN', idle: 'IDLE', unknown: 'UNKNOWN' }
  const colors = { ok: '#4ade80', warning: '#facc15', error: '#ef4444', idle: '#52525b', unknown: '#52525b' }
  return (
    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: colors[status] }}>
      {labels[status]}
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const last36h = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString()

  // Parallel data fetching
  const [
    { data: espnHealth },
    { data: syncLogs },
    { data: todayLogs },
    { data: lastUfcLog },
    { data: lastClaudeLog },
    { data: todayEvents },
    { data: crossValWarnings },
    { data: completedEvents },
  ] = await Promise.all([
    admin.from('espn_health').select('*').order('updated_at', { ascending: false }),
    admin.from('api_sync_log').select('*, events(name)').order('created_at', { ascending: false }).limit(50),
    admin.from('api_sync_log').select('api_source, status, sync_type').gte('created_at', last24h),
    admin.from('api_sync_log').select('*').eq('api_source', 'ufc_api').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('api_sync_log').select('*').eq('api_source', 'claude').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('events').select('*').in('status', ['live', 'upcoming']).gte('start_time', last36h).order('start_time'),
    admin.from('api_sync_log').select('*, events(name)').eq('sync_type', 'cross_validation').in('status', ['warning', 'error']).order('created_at', { ascending: false }).limit(5),
    admin.from('events').select('id, name').eq('status', 'completed'),
  ])

  // Live event fights (sequential — depends on todayEvents)
  const liveEvent = todayEvents?.find(e => e.status === 'live') ?? todayEvents?.[0] ?? null
  let liveEventFights: Array<{
    id: string; red_name: string; blue_name: string; status: string
    result_winner: string | null; result_method: string | null; result_round: number | null
    bout_order: number; ufc_fight_id: string | null; last_synced_at: string | null
  }> = []
  if (liveEvent) {
    const { data } = await admin.from('fights').select('id, red_name, blue_name, status, result_winner, result_method, result_round, bout_order, ufc_fight_id, last_synced_at').eq('event_id', liveEvent.id).order('bout_order', { ascending: true })
    liveEventFights = (data ?? []) as typeof liveEventFights
  }

  // Pending fights in completed events
  let pendingInCompleted: Array<{ id: string; red_name: string; blue_name: string; event_id: string; event_name: string }> = []
  if ((completedEvents ?? []).length > 0) {
    const ids = completedEvents!.map(e => e.id)
    const { data: pf } = await admin.from('fights').select('id, red_name, blue_name, event_id').eq('status', 'scheduled').in('event_id', ids).limit(10)
    const nameMap = Object.fromEntries(completedEvents!.map(e => [e.id, e.name]))
    pendingInCompleted = (pf ?? []).map(f => ({ ...f, event_name: nameMap[f.event_id] ?? 'Unknown' }))
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const tl = todayLogs ?? []
  const totalSyncs = tl.length
  const espnLogs = tl.filter(l => l.api_source === 'espn')
  const espnUptime = espnLogs.length > 0
    ? Math.round(espnLogs.filter(l => ['success', 'partial'].includes(l.status)).length / espnLogs.length * 100)
    : 100
  const claudeCalls = tl.filter(l => l.api_source === 'claude').length
  const crossVals = tl.filter(l => l.sync_type === 'cross_validation').length
  const errorsToday = tl.filter(l => l.status === 'error').length

  // ─── API health derivation ────────────────────────────────────────────────
  const espn = espnHealth?.[0] ?? null
  const espnStatus: 'ok' | 'warning' | 'error' | 'idle' | 'unknown' =
    !espn ? 'unknown' :
    espn.consecutive_failures >= 5 ? 'error' :
    espn.consecutive_failures >= 2 ? 'warning' : 'ok'

  const ufcStatus: 'ok' | 'warning' | 'error' | 'idle' | 'unknown' =
    !lastUfcLog ? 'idle' :
    lastUfcLog.status === 'error' ? 'error' :
    lastUfcLog.status === 'warning' ? 'warning' : 'ok'

  const claudeStatus: 'ok' | 'warning' | 'error' | 'idle' | 'unknown' =
    !lastClaudeLog ? 'idle' :
    lastClaudeLog.status === 'error' ? 'error' :
    lastClaudeLog.status === 'warning' ? 'warning' : 'ok'

  // ─── Feed logs (serializable for client) ─────────────────────────────────
  const feedLogs: LogEntry[] = (syncLogs ?? []).map(l => ({
    id: l.id,
    created_at: l.created_at,
    sync_type: l.sync_type,
    event_id: l.event_id,
    api_source: l.api_source,
    status: l.status,
    request_count: l.request_count,
    details: l.details,
    event_name: (l.events as unknown as { name: string } | null)?.name ?? null,
  }))

  const integrityCount = pendingInCompleted.length + (crossValWarnings?.length ?? 0)

  const methodShort: Record<string, string> = {
    decision: 'DEC', ko_tko: 'KO/TKO', submission: 'SUB', dq: 'DQ', nc: 'NC', draw: 'DRAW',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* ─── Back button ─────────────────────────────────────────────────── */}
      <Link href="/admin" className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70">
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#52525b] uppercase mb-1">Back to</span>
          <span className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}>Admin</span>
        </div>
      </Link>

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold text-[#e11d48] uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3" />
            Admin Panel
          </p>
          <h1
            className="text-[#f4f4f5] uppercase leading-none"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)' }}
          >
            System Status
          </h1>
        </div>
        <div className="text-right shrink-0 mt-1">
          <div className="flex items-center gap-1.5 justify-end mb-1">
            <span className={`w-1.5 h-1.5 rounded-full ${liveEvent?.status === 'live' ? 'bg-green-400 animate-pulse' : 'bg-[#3f3f46]'}`} />
            <span className="text-[10px] text-[#71717a]">
              {liveEvent?.status === 'live' ? 'Auto-refreshing' : 'Static snapshot'}
            </span>
          </div>
          <p className="text-[10px] text-[#3f3f46] font-mono">
            {liveEvent?.status === 'live'
              ? <>Next refresh · <RefreshCountdown intervalMs={60000} /></>
              : <>Loaded · <RefreshTimestamp time={now.toLocaleTimeString()} /></>
            }
          </p>
        </div>
      </div>

      {/* ─── API Health Cards ─────────────────────────────────────────────── */}
      <section className="mb-5">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3">API Health</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">

          {/* ESPN */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-[#60a5fa]" />
                <span className="text-xs font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)' }}>ESPN API</span>
                <span className="text-[9px] text-[#3f3f46] font-mono border border-[#27272a] px-1 rounded">T1</span>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot status={espnStatus} />
                <StatusLabel status={espnStatus} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[10px]">
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Failures</p>
                <p className={`font-mono font-bold ${(espn?.consecutive_failures ?? 0) > 0 ? 'text-amber-400' : 'text-[#71717a]'}`}>
                  {espn?.consecutive_failures ?? 0} consecutive
                </p>
              </div>
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Last Success</p>
                <p className="font-mono text-[#71717a]">{relTime(espn?.last_success_at)}</p>
              </div>
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Uptime Today</p>
                <p className={`font-mono font-bold ${espnUptime === 100 ? 'text-green-400' : espnUptime >= 90 ? 'text-amber-400' : 'text-red-400'}`}>
                  {espnUptime}%
                </p>
              </div>
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Updated</p>
                <p className="font-mono text-[#71717a]">{relTime(espn?.updated_at)}</p>
              </div>
            </div>
          </div>

          {/* UFC API */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)' }}>UFC API</span>
                <span className="text-[9px] text-[#3f3f46] font-mono border border-[#27272a] px-1 rounded">T2</span>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot status={ufcStatus} />
                <StatusLabel status={ufcStatus} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[10px]">
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Last Used</p>
                <p className="font-mono text-[#71717a]">{relTime(lastUfcLog?.created_at)}</p>
              </div>
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Last Status</p>
                <p className="font-mono text-[#71717a]">{lastUfcLog?.status ?? '—'}</p>
              </div>
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Coverage</p>
                <p className="font-mono text-[#71717a]">fight IDs via cron</p>
              </div>
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Mode</p>
                <p className="font-mono text-[#71717a]">cross-check + fallback</p>
              </div>
            </div>
          </div>

          {/* Claude */}
          <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)' }}>Claude AI</span>
                <span className="text-[9px] text-[#3f3f46] font-mono border border-[#27272a] px-1 rounded">T3</span>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusDot status={claudeStatus} />
                <StatusLabel status={claudeStatus} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-[10px]">
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Calls Today</p>
                <p className={`font-mono font-bold ${claudeCalls > 0 ? 'text-purple-400' : 'text-[#71717a]'}`}>{claudeCalls}</p>
              </div>
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Last Called</p>
                <p className="font-mono text-[#71717a]">{relTime(lastClaudeLog?.created_at)}</p>
              </div>
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Rate Limit</p>
                <p className="font-mono text-[#71717a]">3 min / event</p>
              </div>
              <div>
                <p className="text-[#3f3f46] mb-0.5 uppercase tracking-wide text-[9px]">Mode</p>
                <p className="font-mono text-[#71717a]">validation + fallback</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Row ───────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: 'Syncs Today', value: totalSyncs, color: '#60a5fa' },
            { label: 'ESPN Uptime', value: `${espnUptime}%`, color: espnUptime === 100 ? '#4ade80' : espnUptime >= 90 ? '#facc15' : '#ef4444' },
            { label: 'Claude Calls', value: claudeCalls, color: claudeCalls > 0 ? '#c084fc' : '#52525b' },
            { label: 'Cross-Vals', value: crossVals, color: crossVals > 0 ? '#fb923c' : '#52525b' },
            { label: 'Errors Today', value: errorsToday, color: errorsToday > 0 ? '#ef4444' : '#4ade80' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#111111] border border-[#1e1e1e] rounded-xl py-3 px-4 text-center">
              <p
                className="text-2xl leading-none mb-1.5 font-black"
                style={{ fontFamily: 'var(--font-barlow)', color }}
              >
                {value}
              </p>
              <p className="text-[9px] text-[#52525b] uppercase tracking-[0.12em]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── System Test ─────────────────────────────────────────────────────── */}
      <section className="mb-6">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3">Tools</p>
        <div className="flex flex-col gap-3">
          <SystemTestButton />
          <ClaudeCheckButton />
        </div>
      </section>

      {/* ─── Main 2-col ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-5">

        {/* Left column */}
        <div className="space-y-5">

          {/* Live Event Monitor */}
          {liveEvent && (
            <section>
              <div className="flex items-center gap-2.5 mb-3">
                <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">
                  {liveEvent.status === 'live' ? 'Live Event' : "Tonight's Event"}
                </p>
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${
                  liveEvent.status === 'live'
                    ? 'bg-[#e11d48]/10 border-[#e11d48]/20 text-[#e11d48]'
                    : 'bg-[#27272a] border-[#27272a] text-[#71717a]'
                }`}>
                  {liveEvent.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse" />}
                  {liveEvent.status}
                </span>
              </div>

              <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden">
                {/* Event header */}
                <div className="px-4 py-3 border-b border-[#1a1a1a] flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                      {liveEvent.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-[#52525b]">{liveEvent.venue ?? 'Venue TBD'}</span>
                      <span className="text-[10px] font-mono text-[#3f3f46]">fmid: {liveEvent.ufc_event_fmid ?? <span className="text-amber-400/70">not set</span>}</span>
                      {liveEvent.espn_event_id && <span className="text-[10px] font-mono text-[#3f3f46]">espn: {liveEvent.espn_event_id}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-[#52525b]">{liveEventFights.length} fights</p>
                    <p className="text-[10px] font-mono text-[#3f3f46] mt-0.5">
                      {liveEventFights.filter(f => f.status === 'final').length} complete
                    </p>
                  </div>
                </div>

                {/* Fight grid */}
                <div className="divide-y divide-[#141414]">
                  {liveEventFights.map(f => {
                    const isDone = f.status === 'final'
                    const isLive = f.status === 'live'
                    const isCancelled = f.status === 'cancelled'
                    return (
                      <div
                        key={f.id}
                        className={`flex items-center justify-between px-4 py-2.5 ${
                          isDone ? 'bg-green-400/[0.03]' :
                          isLive ? 'bg-amber-400/[0.04]' :
                          isCancelled ? 'opacity-40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[9px] text-[#3f3f46] font-mono w-5 shrink-0">#{f.bout_order}</span>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[11px] font-semibold text-[#e11d48] truncate">{f.red_name.split(' ').pop()}</span>
                            <span className="text-[9px] text-[#3f3f46]">vs</span>
                            <span className="text-[11px] font-semibold text-[#60a5fa] truncate">{f.blue_name.split(' ').pop()}</span>
                          </div>
                          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />}
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 ml-3">
                          {isDone && f.result_winner ? (
                            <>
                              <span className={`text-[10px] font-bold ${
                                f.result_winner === 'red' ? 'text-[#e11d48]' :
                                f.result_winner === 'blue' ? 'text-[#60a5fa]' : 'text-[#a1a1aa]'
                              }`}>
                                {f.result_winner === 'red' ? f.red_name.split(' ').pop() :
                                 f.result_winner === 'blue' ? f.blue_name.split(' ').pop() :
                                 f.result_winner.toUpperCase()}
                              </span>
                              {f.result_method && (
                                <span className="text-[9px] font-mono text-[#71717a] bg-[#1a1a1a] px-1.5 py-0.5 rounded">
                                  {methodShort[f.result_method] ?? f.result_method}
                                  {f.result_round ? ` R${f.result_round}` : ''}
                                </span>
                              )}
                            </>
                          ) : !isLive && !isCancelled ? (
                            <span className="text-[9px] text-[#3f3f46]">pending</span>
                          ) : null}

                          {!f.ufc_fight_id && !isCancelled && (
                            <span className="text-[9px] text-amber-400/50 font-mono">no UFC id</span>
                          )}

                          {f.last_synced_at && (
                            <span className="text-[9px] text-[#3f3f46] font-mono">{relTime(f.last_synced_at)}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Data Integrity Panel */}
          <section>
            <div className="flex items-center gap-2.5 mb-3">
              <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">Data Integrity</p>
              {integrityCount > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {integrityCount}
                </span>
              )}
            </div>
            <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl divide-y divide-[#1a1a1a] overflow-hidden">
              {integrityCount === 0 ? (
                <div className="p-5 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-xs text-green-400">No integrity issues detected</span>
                </div>
              ) : (
                <>
                  {pendingInCompleted.map(f => (
                    <div key={f.id} className="p-3.5 flex items-start gap-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] text-[#f4f4f5]">Pending fight in completed event</p>
                        <p className="text-[10px] text-[#52525b] mt-0.5">
                          <span className="text-[#e11d48]">{f.red_name}</span> vs <span className="text-[#60a5fa]">{f.blue_name}</span>
                          <span className="text-[#3f3f46] mx-1">·</span>
                          <span className="text-[#71717a]">{f.event_name}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                  {(crossValWarnings ?? []).map(w => (
                    <div key={w.id} className="p-3.5 flex items-start gap-2.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-[#f4f4f5]">Cross-validation mismatch</p>
                        <p className="text-[10px] text-[#52525b] mt-0.5">
                          <span className="text-[#71717a]">{(w.events as unknown as { name: string } | null)?.name ?? 'Unknown event'}</span>
                          <span className="text-[#3f3f46] mx-1">·</span>
                          <span className="font-mono">{relTime(w.created_at)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          {/* No today event notice */}
          {!liveEvent && (
            <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-5 flex items-center gap-3">
              <Activity className="w-4 h-4 text-[#3f3f46] shrink-0" />
              <div>
                <p className="text-xs text-[#52525b]">No events scheduled for today</p>
                <p className="text-[10px] text-[#3f3f46] mt-0.5">Live event monitor will appear here on fight day</p>
              </div>
            </div>
          )}
        </div>

        {/* Right column — Activity Feed */}
        <div>
          <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3">Activity Feed</p>
          <ActivityFeed logs={feedLogs} />
        </div>
      </div>
    </div>
  )
}
