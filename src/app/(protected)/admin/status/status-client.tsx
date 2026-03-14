'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, FlaskConical, CheckCircle2, XCircle } from 'lucide-react'
import { runSystemTest } from '@/actions/admin'
import type { SystemTestResult } from '@/actions/admin'

// ─── Auto-refresh ─────────────────────────────────────────────────────────────

export function StatusRefresher({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])
  return null
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogEntry = {
  id: string
  created_at: string
  sync_type: string
  event_id: string | null
  api_source: string
  status: string
  request_count: number
  details: unknown
  event_name: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

const SOURCE_COLOR: Record<string, string> = {
  espn: '#60a5fa',
  ufc_api: '#fb923c',
  claude: '#c084fc',
}

const SOURCE_LABEL: Record<string, string> = {
  espn: 'ESPN',
  ufc_api: 'UFC',
  claude: 'AI',
}

const STATUS_COLOR: Record<string, string> = {
  success: '#4ade80',
  partial: '#86efac',
  warning: '#facc15',
  error: '#ef4444',
}

const SYNC_TYPE_LABEL: Record<string, string> = {
  event_import: 'Event Import',
  card_update: 'Card Update',
  live_results: 'Live Results',
  validation: 'Validation',
  health_check: 'Health Check',
  cross_validation: 'Cross-Val',
}

// ─── Single log row ───────────────────────────────────────────────────────────

function LogEntryRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const srcColor = SOURCE_COLOR[log.api_source] ?? '#a1a1aa'
  const stsColor = STATUS_COLOR[log.status] ?? '#52525b'

  return (
    <div className="border-b border-[#181818] last:border-0">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-3 py-2.5 hover:bg-[#141414] transition-colors group"
      >
        <div className="flex items-start gap-2">
          {/* Source badge */}
          <span
            className="shrink-0 text-[9px] font-bold font-mono px-1.5 py-0.5 rounded mt-px"
            style={{
              color: srcColor,
              backgroundColor: srcColor + '18',
              border: `1px solid ${srcColor}28`,
            }}
          >
            {SOURCE_LABEL[log.api_source] ?? log.api_source.toUpperCase()}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-[#a1a1aa]">
                {SYNC_TYPE_LABEL[log.sync_type] ?? log.sync_type.replace(/_/g, ' ')}
              </span>
              {log.event_name && (
                <span className="text-[10px] text-[#52525b] truncate">· {log.event_name}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono text-[#3f3f46]">{relTime(log.created_at)}</span>
              {log.request_count > 0 && (
                <span className="text-[9px] text-[#3f3f46]">{log.request_count}req</span>
              )}
              {!!log.details && (
                <span className="text-[9px] text-[#3f3f46] group-hover:text-[#52525b] transition-colors">
                  {expanded ? '▲ hide' : '▼ details'}
                </span>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stsColor }} />
            <span className="text-[9px] font-bold uppercase" style={{ color: stsColor }}>
              {log.status}
            </span>
          </div>
        </div>
      </button>

      {expanded && !!log.details && (
        <div className="px-3 pb-3">
          <pre className="text-[9px] font-mono text-[#71717a] bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-2.5 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
            {JSON.stringify(log.details as Record<string, unknown>, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

export function ActivityFeed({ logs }: { logs: LogEntry[] }) {
  const [srcFilter, setSrcFilter] = useState('all')
  const [stsFilter, setStsFilter] = useState('all')

  const filtered = logs.filter(l => {
    if (srcFilter !== 'all' && l.api_source !== srcFilter) return false
    if (stsFilter !== 'all' && l.status !== stsFilter) return false
    return true
  })

  const FilterBtn = ({
    active, onClick, color, children,
  }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className="px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-colors"
      style={{
        color: active ? (color ?? '#f4f4f5') : '#3f3f46',
        backgroundColor: active ? (color ? color + '18' : '#27272a') : 'transparent',
        border: `1px solid ${active ? (color ? color + '40' : '#3f3f46') : 'transparent'}`,
      }}
    >
      {children}
    </button>
  )

  return (
    <div
      className="bg-[#111111] border border-[#1e1e1e] rounded-xl overflow-hidden flex flex-col"
      style={{ height: 'clamp(400px, calc(100vh - 340px), 800px)' }}
    >
      {/* Filter bar */}
      <div className="px-3 py-2 border-b border-[#1a1a1a] flex flex-wrap items-center gap-1">
        <FilterBtn active={srcFilter === 'all'} onClick={() => setSrcFilter('all')}>All</FilterBtn>
        {['espn', 'ufc_api', 'claude'].map(s => (
          <FilterBtn key={s} active={srcFilter === s} onClick={() => setSrcFilter(s)} color={SOURCE_COLOR[s]}>
            {SOURCE_LABEL[s]}
          </FilterBtn>
        ))}
        <div className="w-px h-3 bg-[#27272a] mx-0.5" />
        <FilterBtn active={stsFilter === 'all'} onClick={() => setStsFilter('all')}>All</FilterBtn>
        {['success', 'warning', 'error'].map(s => (
          <FilterBtn key={s} active={stsFilter === s} onClick={() => setStsFilter(s)} color={STATUS_COLOR[s]}>
            {s}
          </FilterBtn>
        ))}
      </div>

      {/* Entries */}
      <div className="overflow-y-auto flex-1 scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[10px] text-[#52525b]">No entries match filters</div>
        ) : (
          filtered.map(log => <LogEntryRow key={log.id} log={log} />)
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-[#1a1a1a] flex items-center justify-between">
        <span className="text-[9px] text-[#3f3f46]">{filtered.length} / {logs.length} entries</span>
        <span className="text-[9px] text-[#3f3f46] font-mono">last 50</span>
      </div>
    </div>
  )
}

// ─── System Test Button ───────────────────────────────────────────────────────

export function SystemTestButton() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<SystemTestResult | null>(null)

  async function handleRun() {
    setStatus('running')
    setResult(null)
    try {
      const res = await runSystemTest()
      setResult(res)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  const Check = ({ ok, label, latencyMs }: { ok: boolean; label: string; latencyMs?: number }) => (
    <div className="flex items-center gap-2">
      {ok
        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
        : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
      }
      <span className={`text-xs font-medium ${ok ? 'text-[#a1a1aa]' : 'text-red-400'}`}>{label}</span>
      {latencyMs !== undefined && (
        <span className={`text-[10px] font-mono ${latencyMs < 500 ? 'text-green-400' : latencyMs < 1500 ? 'text-amber-400' : 'text-red-400'}`}>
          {latencyMs}ms
        </span>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleRun}
        disabled={status === 'running'}
        className="inline-flex items-center gap-2 h-8 px-3 rounded-lg bg-[#111111] border border-[#1e1e1e] text-[#71717a] text-xs font-semibold hover:text-[#a1a1aa] hover:border-[#27272a] transition-all disabled:opacity-50 cursor-pointer"
      >
        {status === 'running'
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <FlaskConical className="w-3.5 h-3.5" />
        }
        {status === 'running' ? 'Running tests...' : 'Run System Test'}
      </button>

      {status === 'done' && result && (
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-4 space-y-2.5">
          <Check ok={result.espn.ok} label="ESPN API" latencyMs={result.espn.latencyMs} />
          {!result.espn.ok && result.espn.error && (
            <p className="text-[10px] text-red-400/70 font-mono ml-5">{result.espn.error}</p>
          )}
          <Check ok={result.ufc.ok} label="UFC CloudFront API" latencyMs={result.ufc.latencyMs} />
          {!result.ufc.ok && result.ufc.error && (
            <p className="text-[10px] text-red-400/70 font-mono ml-5">{result.ufc.error}</p>
          )}
          <Check ok={result.claude.ok} label="Claude API key" />
          {!result.claude.ok && result.claude.error && (
            <p className="text-[10px] text-red-400/70 font-mono ml-5">{result.claude.error}</p>
          )}
          <Check ok={result.supabase.ok} label="Supabase DB" latencyMs={result.supabase.latencyMs} />
          {!result.supabase.ok && result.supabase.error && (
            <p className="text-[10px] text-red-400/70 font-mono ml-5">{result.supabase.error}</p>
          )}
          <p className="text-[9px] text-[#3f3f46] font-mono pt-1 border-t border-[#1a1a1a]">
            Tested at {new Date(result.ranAt).toLocaleTimeString()}
          </p>
        </div>
      )}

      {status === 'error' && (
        <p className="text-xs text-red-400">Test failed — check console</p>
      )}
    </div>
  )
}
