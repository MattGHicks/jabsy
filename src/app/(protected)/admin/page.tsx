import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Calendar, Swords, Users, ShieldCheck, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { deleteEvent, setEventStatus } from '@/actions/admin'
import { LockCountdown } from '@/components/admin/lock-countdown'

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  live: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
  completed: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  cancelled: 'bg-zinc-900 text-zinc-600 border-zinc-800',
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
        <Link
          href="/admin/events/new"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Event
        </Link>
      </div>

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
                <div>
                  <p
                    className="text-xl text-[#f4f4f5] uppercase leading-tight truncate"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                  >
                    {event.name}
                  </p>
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
