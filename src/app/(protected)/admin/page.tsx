import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Search, Plus, Calendar, Swords, Users, ShieldCheck, Pencil, Trash2, RefreshCw, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { deleteEvent, setEventStatus } from '@/actions/admin'
import { LockCountdown } from '@/components/admin/lock-countdown'
import type { Json } from '@/types/database'

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  live: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
  completed: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  cancelled: 'bg-zinc-900 text-zinc-600 border-zinc-800',
}

function summarizeAlertDetails(details: Json | null): string {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return 'No details'
  const d = details as Record<string, unknown>

  if (d.type === 'stuck_events') return `${(d.events as unknown[])?.length ?? 0} event(s) stuck in live status >24h`
  if (d.type === 'consecutive_failures') return `ESPN ${d.endpoint} endpoint: ${d.count} consecutive failures`
  if (d.type === 'result_extraction_failed') return `Could not extract result for competition ${d.competition_id}`
  if (d.type === 'corners_extraction_failed') return `Could not extract fighter corners for competition ${d.competition_id}`
  if (d.type === 'recalculate_failed') return `Pick recalculation failed: ${d.error}`
  if (d.type === 'event_not_found') return `ESPN event ${d.espn_event_id} not found in calendar`
  if (d.warnings) return `${(d.warnings as unknown[]).length} validation warning(s)`
  if (d.error) return String(d.error).slice(0, 120)
  if (d.issues) return (d.issues as string[]).join('; ').slice(0, 120)
  return JSON.stringify(details).slice(0, 120)
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // Stats
  const [
    { count: eventCount },
    { count: fightCount },
    { count: leagueCount },
    { count: userCount },
  ] = await Promise.all([
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase.from('fights').select('*', { count: 'exact', head: true }),
    supabase.from('leagues').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
  ])

  // Events with fight counts
  const { data: events } = await supabase
    .from('events')
    .select('*, fights(id)')
    .order('start_time', { ascending: false })

  // Recent alerts (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentAlerts } = await supabase
    .from('api_sync_log')
    .select('*')
    .in('status', ['error', 'warning'])
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(10)

  // ESPN health status
  const { data: healthStatus } = await supabase
    .from('espn_health')
    .select('*')

  // Count warnings per event for badge display
  const warningsByEvent = new Map<string, number>()
  for (const alert of recentAlerts ?? []) {
    if (alert.event_id) {
      warningsByEvent.set(alert.event_id, (warningsByEvent.get(alert.event_id) ?? 0) + 1)
    }
  }

  const unhealthyEndpoints = (healthStatus ?? []).filter(h => h.consecutive_failures >= 5)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/20 mb-3">
            <ShieldCheck className="w-3 h-3 text-[#e11d48]" />
            <span className="text-xs font-semibold text-[#e11d48] uppercase tracking-widest">Admin</span>
          </div>
          <h1
            className="leading-none text-[#f4f4f5]"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
          >
            ADMIN DASHBOARD
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/search"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors"
          >
            <Search className="w-4 h-4" />
            Search for Events
          </Link>
          <Link
            href="/admin/events/new"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-[#1e1e1e] border border-[#27272a] text-[#a1a1aa] text-sm font-semibold hover:text-[#f4f4f5] hover:border-[#333] transition-colors"
            title="Manual create"
          >
            <Plus className="w-4 h-4" />
            Manual
          </Link>
        </div>
      </div>

      {/* ESPN Health Banner */}
      {unhealthyEndpoints.length > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/30 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#e11d48] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#e11d48]">ESPN API Issues Detected</p>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              {unhealthyEndpoints.map(h =>
                `${h.endpoint}: ${h.consecutive_failures} consecutive failures`
              ).join(' | ')}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {[
          { icon: Calendar, label: 'Events', value: eventCount ?? 0 },
          { icon: Swords, label: 'Fights', value: fightCount ?? 0 },
          { icon: ShieldCheck, label: 'Leagues', value: leagueCount ?? 0 },
          { icon: Users, label: 'Users', value: userCount ?? 0 },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="p-4 rounded-lg bg-[#141414] border border-[#1e1e1e]">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-3.5 h-3.5 text-[#52525b]" />
              <span className="text-xs text-[#71717a]">{label}</span>
            </div>
            <p
              className="text-2xl font-black text-[#f4f4f5]"
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Alerts */}
      {recentAlerts && recentAlerts.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Recent Alerts
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {recentAlerts.length}
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {recentAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${
                  alert.status === 'error'
                    ? 'bg-[#e11d48]/5 border-[#e11d48]/20'
                    : 'bg-amber-500/5 border-amber-500/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${
                    alert.status === 'error' ? 'text-[#e11d48]' : 'text-amber-400'
                  }`}>
                    {alert.sync_type.replace(/_/g, ' ')} — {alert.status}
                  </span>
                  <span className="text-[10px] text-[#52525b]">
                    {formatDateTime(alert.created_at)}
                  </span>
                </div>
                <p className="text-xs text-[#71717a] mt-1">
                  {summarizeAlertDetails(alert.details)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events list */}
      <div>
        <h2 className="text-sm font-semibold text-[#a1a1aa] uppercase tracking-widest mb-4">
          Events
        </h2>

        {(!events || events.length === 0) && (
          <div className="flex flex-col items-center py-16 text-center">
            <Calendar className="w-8 h-8 text-[#52525b] mb-3" />
            <p className="text-sm text-[#71717a]">No events yet. Create one to get started.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {(events ?? []).map((event) => {
            const fightCount = (event.fights as { id: string }[])?.length ?? 0
            const issueCount = warningsByEvent.get(event.id)
            return (
              <div
                key={event.id}
                className="flex flex-col gap-4 p-5 rounded-xl bg-[#141414] border border-[#1e1e1e] hover:border-[#27272a] transition-colors"
              >
                {/* Top row: status badge + action buttons */}
                <div className="flex items-center justify-between gap-3">
                  <div className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border capitalize ${STATUS_STYLES[event.status] ?? STATUS_STYLES.upcoming}`}>
                    {event.status === 'live' && (
                      <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse inline-block" />
                    )}
                    {event.status}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/admin/events/${event.id}`}
                      className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md text-xs font-semibold border border-[#27272a] bg-[#1e1e1e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333] transition-colors"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      Manage Fights
                    </Link>
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-md text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#1e1e1e] border border-transparent hover:border-[#27272a] transition-colors"
                      title="Edit event"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <form action={async () => {
                      'use server'
                      await deleteEvent(event.id)
                    }}>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center w-9 h-9 rounded-md text-[#52525b] hover:text-[#e11d48] hover:bg-[#e11d48]/5 border border-transparent hover:border-[#e11d48]/20 transition-colors cursor-pointer"
                        title="Delete event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </div>

                {/* Event name */}
                <div className="flex items-center gap-2">
                  <p
                    className="text-xl text-[#f4f4f5] uppercase leading-tight truncate"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                  >
                    {event.name}
                  </p>
                  {event.espn_event_id && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <RefreshCw className="w-2.5 h-2.5" />
                      Synced
                    </span>
                  )}
                  {issueCount && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {issueCount} issue{issueCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Bottom row: meta info */}
                <div className="pt-3 border-t border-[#1e1e1e] flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[#71717a]">
                    {formatDateTime(event.start_time)}
                    <span className="mx-1.5 text-[#333]">·</span>
                    {fightCount} {fightCount === 1 ? 'fight' : 'fights'}
                    {event.venue && (
                      <>
                        <span className="mx-1.5 text-[#333]">·</span>
                        {event.venue}
                      </>
                    )}
                  </p>
                  <span className="text-xs">
                    <LockCountdown lockTime={(event as { lock_time?: string | null }).lock_time ?? null} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
