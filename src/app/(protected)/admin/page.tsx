import { redirect } from 'next/navigation'
import { Calendar, Swords, Users, ShieldCheck, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { AdminEvents } from './admin-events'
import { SherdogBackfill } from '@/components/admin/sherdog-backfill'
import type { Json } from '@/types/database'

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
    .order('start_time', { ascending: true })

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
  const warningsByEvent: Record<string, number> = {}
  for (const alert of recentAlerts ?? []) {
    if (alert.event_id) {
      warningsByEvent[alert.event_id] = (warningsByEvent[alert.event_id] ?? 0) + 1
    }
  }

  const unhealthyEndpoints = (healthStatus ?? []).filter(h => h.consecutive_failures >= 5)

  const stats = [
    { icon: Calendar, label: 'Events', value: eventCount ?? 0, accent: '#60a5fa', accentBg: 'rgba(96,165,250,0.08)', accentBorder: 'rgba(96,165,250,0.15)' },
    { icon: Swords, label: 'Fights', value: fightCount ?? 0, accent: '#e11d48', accentBg: 'rgba(225,29,72,0.08)', accentBorder: 'rgba(225,29,72,0.15)' },
    { icon: ShieldCheck, label: 'Leagues', value: leagueCount ?? 0, accent: '#34d399', accentBg: 'rgba(52,211,153,0.08)', accentBorder: 'rgba(52,211,153,0.15)' },
    { icon: Users, label: 'Users', value: userCount ?? 0, accent: '#71717a', accentBg: 'rgba(113,113,122,0.08)', accentBorder: 'rgba(113,113,122,0.15)' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[10px] font-semibold text-[#e11d48] uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" />
          Admin Panel
        </p>
        <h1
          className="leading-[0.9] text-[#f4f4f5] uppercase"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2.2rem, 5vw, 3.5rem)' }}
        >
          Admin Dashboard
        </h1>
      </div>

      {/* ESPN Health Banner */}
      {unhealthyEndpoints.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center gap-3">
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
      <section className="mb-10">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3">Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {stats.map(({ icon: Icon, label, value, accent, accentBg, accentBorder }) => (
            <div key={label} className="flex flex-col items-center gap-2 py-5 px-3 rounded-xl bg-[#111111] border border-[#1e1e1e]">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
              >
                <Icon className="w-5 h-5" style={{ color: accent }} />
              </div>
              <div className="text-center">
                <p
                  className="text-3xl leading-none text-[#f4f4f5] mb-1"
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                >
                  {value}
                </p>
                <p className="text-[10px] text-[#52525b] uppercase tracking-[0.12em]">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tools */}
      <section className="mb-10">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3">Tools</p>
        <SherdogBackfill />
      </section>

      {/* Recent Alerts */}
      {recentAlerts && recentAlerts.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2.5 mb-3">
            <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Recent Alerts
            </p>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {recentAlerts.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {recentAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border ${
                  alert.status === 'error'
                    ? 'bg-[#e11d48]/[0.03] border-[#e11d48]/15'
                    : 'bg-amber-500/[0.03] border-amber-500/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                    alert.status === 'error' ? 'text-[#e11d48]' : 'text-amber-400'
                  }`}>
                    {alert.sync_type.replace(/_/g, ' ')} — {alert.status}
                  </span>
                  <span className="text-[10px] text-[#52525b]">
                    {formatDateTime(alert.created_at)}
                  </span>
                </div>
                <p className="text-xs text-[#52525b] mt-1.5">
                  {summarizeAlertDetails(alert.details)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Events */}
      <section>
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3">Events</p>
        <AdminEvents
          events={(events ?? []).map(e => ({
            id: e.id,
            name: e.name,
            start_time: e.start_time,
            status: e.status,
            venue: e.venue,
            espn_event_id: e.espn_event_id,
            lock_time: (e as { lock_time?: string | null }).lock_time ?? null,
            fights: (e.fights as { id: string }[]) ?? [],
          }))}
          warningsByEvent={warningsByEvent}
        />
      </section>
    </div>
  )
}
