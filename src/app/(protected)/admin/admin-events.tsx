'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Plus, Swords, Pencil, Trash2, RefreshCw, AlertTriangle, Calendar } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { deleteEvent } from '@/actions/admin'
import { LockCountdown } from '@/components/admin/lock-countdown'

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  live: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
  completed: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  cancelled: 'bg-zinc-900 text-zinc-600 border-zinc-800',
}

type EventWithFights = {
  id: string
  name: string
  start_time: string
  status: string
  venue: string | null
  espn_event_id: string | null
  lock_time?: string | null
  fights: { id: string }[]
}

interface AdminEventsProps {
  events: EventWithFights[]
  warningsByEvent: Record<string, number>
}

export function AdminEvents({ events, warningsByEvent }: AdminEventsProps) {
  const [filter, setFilter] = useState<'upcoming' | 'completed'>('upcoming')

  const activeEvents = events.filter(e => e.status === 'upcoming' || e.status === 'live')
  const completedEvents = events.filter(e => e.status === 'completed' || e.status === 'cancelled')
  const filtered = filter === 'upcoming' ? activeEvents : completedEvents

  return (
    <section>
      {/* Section header with action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('upcoming')}
            className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.08em] transition-colors cursor-pointer ${
              filter === 'upcoming'
                ? 'bg-[#1a1a1a] text-[#f4f4f5] border border-[#27272a]'
                : 'text-[#52525b] hover:text-[#71717a] border border-[#1e1e1e]'
            }`}
          >
            Upcoming
            {activeEvents.length > 0 && (
              <span className={`text-[9px] ${filter === 'upcoming' ? 'text-[#52525b]' : 'text-[#3f3f46]'}`}>
                {activeEvents.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter('completed')}
            className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-[11px] font-bold uppercase tracking-[0.08em] transition-colors cursor-pointer ${
              filter === 'completed'
                ? 'bg-[#1a1a1a] text-[#f4f4f5] border border-[#27272a]'
                : 'text-[#52525b] hover:text-[#71717a] border border-[#1e1e1e]'
            }`}
          >
            Completed
            {completedEvents.length > 0 && (
              <span className={`text-[9px] ${filter === 'completed' ? 'text-[#52525b]' : 'text-[#3f3f46]'}`}>
                {completedEvents.length}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/admin/search"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] text-xs font-semibold hover:bg-[#e11d48]/15 hover:border-[#e11d48]/30 transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </Link>
          <Link
            href="/admin/events/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#111111] border border-[#1e1e1e] text-[#71717a] text-xs font-semibold hover:text-[#a1a1aa] hover:border-[#27272a] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Manual
          </Link>
        </div>
      </div>

      {/* Event list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Calendar className="w-8 h-8 text-[#3f3f46] mb-3" />
          <p className="text-sm text-[#52525b]">
            {filter === 'upcoming' ? 'No upcoming events' : 'No completed events'}
          </p>
          {filter === 'upcoming' && (
            <p className="text-xs text-[#3f3f46] mt-0.5">Search for one to get started</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((event) => {
            const fightCount = event.fights?.length ?? 0
            const issueCount = warningsByEvent[event.id]
            return (
              <div
                key={event.id}
                className="flex flex-col gap-4 p-5 rounded-xl bg-[#111111] border border-[#1e1e1e] hover:border-[#27272a] transition-colors"
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
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-[#1e1e1e] bg-[#111111] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#27272a] transition-colors"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      Manage Fights
                    </Link>
                    <Link
                      href={`/admin/events/${event.id}/edit`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#1a1a1a] transition-colors"
                      title="Edit event"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <form action={deleteEvent.bind(null, event.id)}>
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#52525b] hover:text-[#e11d48] hover:bg-[#e11d48]/5 transition-colors cursor-pointer"
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
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <RefreshCw className="w-2.5 h-2.5" />
                      Synced
                    </span>
                  )}
                  {issueCount && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {issueCount} issue{issueCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Bottom row: meta info */}
                <div className="pt-3 border-t border-[#1e1e1e] flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[#52525b]">
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
                    <LockCountdown lockTime={event.lock_time ?? null} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
