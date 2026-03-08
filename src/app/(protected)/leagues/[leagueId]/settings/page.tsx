import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft, Plus, Trash2, Copy, Calendar, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { addEventToLeague, removeEventFromLeague, updateLeague } from '@/actions/leagues'
import { createInvite, deleteInvite } from '@/actions/invites'

async function generateInviteAction(leagueId: string) {
  'use server'
  await createInvite(leagueId, 100)
}
import { formatDate } from '@/lib/utils'
import { SettingsClient } from './settings-client'
import { DeleteLeagueButton } from './delete-league-button'

interface PageProps {
  params: Promise<{ leagueId: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}

export default async function LeagueSettingsPage({ params, searchParams }: PageProps) {
  const { leagueId } = await params
  const { error, success } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get league
  const { data: league } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', leagueId)
    .single()

  if (!league) notFound()
  if (league.owner_id !== user.id) redirect(`/leagues/${leagueId}`)

  // Get events already in this league
  const { data: leagueEvents } = await supabase
    .from('league_events')
    .select('event_id, events(id, name, start_time, status, venue)')
    .eq('league_id', leagueId)

  const activeEventIds = new Set((leagueEvents ?? []).map((le) => le.event_id))
  const activeEvents = (leagueEvents ?? [])
    .map((le) => le.events)
    .filter(Boolean) as Array<{ id: string; name: string; start_time: string; status: string; venue: string | null }>

  // Get all master events not yet in this league
  const { data: allEvents } = await supabase
    .from('events')
    .select('id, name, start_time, status, venue')
    .order('start_time', { ascending: false })

  const availableEvents = (allEvents ?? []).filter((e) => !activeEventIds.has(e.id))

  // Get invites
  const { data: invites } = await supabase
    .from('invites')
    .select('*')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })

  // Get member count
  const { count: memberCount } = await supabase
    .from('league_members')
    .select('*', { count: 'exact', head: true })
    .eq('league_id', leagueId)

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <Link href={`/leagues/${leagueId}`} className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70">
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#3f3f46] uppercase mb-1">League</span>
          <span className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}>{league.name}</span>
        </div>
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-[#f4f4f5] mb-1 uppercase"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)' }}
        >
          LEAGUE SETTINGS
        </h1>
        <p className="text-sm text-[#71717a]">{league.name} · {memberCount ?? 0} members</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 text-sm text-[#e11d48]">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400">
          {success}
        </div>
      )}

      <div className="flex flex-col gap-8">
        {/* League Info */}
        <section className="rounded-xl border border-[#1e1e1e] bg-[#111111] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e1e]">
            <h2 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">League Info</h2>
          </div>
          <div className="p-5">
            <form action={updateLeague} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={leagueId} />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">League Name</label>
                <input
                  name="name"
                  defaultValue={league.name}
                  required
                  className="h-10 px-3 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-[#f4f4f5] text-sm placeholder:text-[#52525b] focus:outline-none focus:border-[#e11d48] transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">Description <span className="text-[#52525b] normal-case">(optional)</span></label>
                <textarea
                  name="description"
                  defaultValue={league.description ?? ''}
                  rows={3}
                  className="px-3 py-2.5 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-[#f4f4f5] text-sm placeholder:text-[#52525b] focus:outline-none focus:border-[#e11d48] transition-colors resize-none"
                  placeholder="What's this league about?"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Active Events */}
        <section className="rounded-xl border border-[#1e1e1e] bg-[#111111] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e1e]">
            <h2 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">
              Active Events
              <span className="ml-2 text-xs font-normal text-[#52525b] normal-case">({activeEvents.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {activeEvents.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center text-sm text-[#71717a]">
                <Calendar className="w-6 h-6 mb-2 text-[#3f3f46]" />
                No events added yet. Add events from below.
              </div>
            ) : (
              activeEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#f4f4f5] truncate">{event.name}</p>
                    <p className="text-xs text-[#71717a]">{formatDate(event.start_time)}</p>
                  </div>
                  <EventStatusBadge status={event.status} />
                  <form action={removeEventFromLeague.bind(null, leagueId, event.id)}>
                    <button
                      type="submit"
                      className="h-7 w-7 rounded-md flex items-center justify-center text-[#71717a] hover:text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors"
                      title="Remove event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Available Events */}
        {availableEvents.length > 0 && (
          <section className="rounded-xl border border-[#1e1e1e] bg-[#111111] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1e1e1e]">
              <h2 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">Add Events</h2>
            </div>
            <div className="divide-y divide-[#1e1e1e]">
              {availableEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#a1a1aa] truncate">{event.name}</p>
                    <p className="text-xs text-[#71717a]">{formatDate(event.start_time)}</p>
                  </div>
                  <EventStatusBadge status={event.status} />
                  <form action={addEventToLeague.bind(null, leagueId, event.id)}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-[#1e1e1e] border border-[#27272a] text-xs font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#e11d48] hover:text-[#e11d48] transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Invite Links */}
        <section className="rounded-xl border border-[#1e1e1e] bg-[#111111] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
            <h2 className="text-sm font-semibold text-[#f4f4f5] uppercase tracking-wider">Invite Links</h2>
            <form action={generateInviteAction.bind(null, leagueId)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/20 text-xs font-semibold text-[#e11d48] hover:bg-[#e11d48]/20 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Generate Invite
              </button>
            </form>
          </div>
          <div className="divide-y divide-[#1e1e1e]">
            {(invites ?? []).length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center text-sm text-[#71717a]">
                <p>No invite links yet.</p>
                <p className="text-xs text-[#52525b] mt-1">Generate one to share with players.</p>
              </div>
            ) : (
              (invites ?? []).map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-[#f4f4f5]">{invite.code}</p>
                    <p className="text-xs text-[#71717a]">
                      {invite.use_count}/{invite.max_uses} uses
                      {invite.expires_at ? ` · Expires ${formatDate(invite.expires_at)}` : ' · No expiry'}
                    </p>
                  </div>
                  <SettingsClient inviteCode={invite.code} inviteId={invite.id} leagueId={leagueId} />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="rounded-xl border border-[#e11d48]/20 bg-[#e11d48]/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e11d48]/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#e11d48]" />
              <h2 className="text-sm font-semibold text-[#e11d48] uppercase tracking-wider">Danger Zone</h2>
            </div>
          </div>
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#f4f4f5]">Delete this league</p>
              <p className="text-xs text-[#71717a] mt-0.5">This action cannot be undone. All members and picks will be removed.</p>
            </div>
            <DeleteLeagueButton leagueId={leagueId} />
          </div>
        </section>
      </div>
    </div>
  )
}

function EventStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    upcoming: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    live: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
    completed: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    cancelled: 'bg-zinc-900 text-zinc-600 border-zinc-800',
  }
  const labels: Record<string, string> = {
    upcoming: 'Upcoming',
    live: 'Live',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border shrink-0 ${styles[status] ?? styles.upcoming}`}>
      {labels[status] ?? status}
    </span>
  )
}
