import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft, Plus, Trash2, Calendar, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { addEventToLeague, removeEventFromLeague } from '@/actions/leagues'
import { createInvite } from '@/actions/invites'

async function generateInviteAction(leagueId: string) {
  'use server'
  await createInvite(leagueId, 100)
}
import { formatDate } from '@/lib/utils'
import { SettingsClient } from './settings-client'
import { DeleteLeagueButton } from './delete-league-button'
import { LeagueSettingsForm } from './league-settings-form'

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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back */}
      <Link href={`/leagues/${leagueId}`} className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70">
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#52525b] uppercase mb-1">Back to</span>
          <span className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}>{league.name}</span>
        </div>
      </Link>

      {/* Header */}
      <div className="mb-10">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-1.5">
          {league.name} · {memberCount ?? 0} members
        </p>
        <h1
          className="leading-[0.9] text-[#f4f4f5] uppercase"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2.2rem, 5vw, 3rem)' }}
        >
          League Settings
        </h1>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-[#e11d48]/10 border border-[#e11d48]/20 text-sm text-[#e11d48]">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-400">
          {success}
        </div>
      )}

      <div className="flex flex-col gap-10">
        {/* League Info */}
        <section>
          <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3">League Info</p>
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] p-5">
            <LeagueSettingsForm
              leagueId={leagueId}
              initialName={league.name}
              initialDescription={league.description}
              initialAvatarUrl={league.avatar_url}
            />
          </div>
        </section>

        {/* Active Events */}
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">Active Events</p>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#3f3f46] bg-[#111111] border border-[#1e1e1e]">
              {activeEvents.length}
            </span>
          </div>
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] overflow-hidden">
            {activeEvents.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Calendar className="w-6 h-6 mb-2 text-[#3f3f46]" />
                <p className="text-sm text-[#52525b]">No events added yet</p>
                <p className="text-xs text-[#3f3f46] mt-0.5">Add events from below</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1e1e1e]">
                {activeEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#f4f4f5] truncate">{event.name}</p>
                      <p className="text-xs text-[#52525b] mt-0.5">{formatDate(event.start_time)}</p>
                    </div>
                    <EventStatusBadge status={event.status} />
                    <form action={removeEventFromLeague.bind(null, leagueId, event.id)}>
                      <button
                        type="submit"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-[#52525b] hover:text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors"
                        title="Remove event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Available Events */}
        {availableEvents.length > 0 && (
          <section>
            <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-3">Add Events</p>
            <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] overflow-hidden divide-y divide-[#1e1e1e]">
              {availableEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#a1a1aa] truncate">{event.name}</p>
                    <p className="text-xs text-[#52525b] mt-0.5">{formatDate(event.start_time)}</p>
                  </div>
                  <EventStatusBadge status={event.status} />
                  <form action={addEventToLeague.bind(null, leagueId, event.id)}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-[#1a1a1a] border border-[#27272a] text-xs font-medium text-[#a1a1aa] hover:text-[#e11d48] hover:border-[#e11d48]/30 transition-colors"
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
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em]">Invite Links</p>
            <form action={generateInviteAction.bind(null, leagueId)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#e11d48]/10 border border-[#e11d48]/20 text-xs font-semibold text-[#e11d48] hover:bg-[#e11d48]/20 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Generate Invite
              </button>
            </form>
          </div>
          <div className="rounded-xl border border-[#1e1e1e] bg-[#111111] overflow-hidden">
            {(invites ?? []).length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <p className="text-sm text-[#52525b]">No invite links yet</p>
                <p className="text-xs text-[#3f3f46] mt-0.5">Generate one to share with players</p>
              </div>
            ) : (
              <div className="divide-y divide-[#1e1e1e]">
                {(invites ?? []).map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-[#f4f4f5]">{invite.code}</p>
                      <p className="text-xs text-[#52525b] mt-0.5">
                        {invite.use_count}/{invite.max_uses} uses
                        {invite.expires_at ? ` · Expires ${formatDate(invite.expires_at)}` : ' · No expiry'}
                      </p>
                    </div>
                    <SettingsClient inviteCode={invite.code} inviteId={invite.id} leagueId={leagueId} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <p className="text-[10px] font-semibold text-[#e11d48]/60 uppercase tracking-[0.15em] mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" />
            Danger Zone
          </p>
          <div className="rounded-xl border border-[#e11d48]/15 bg-[#e11d48]/[0.03] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[#f4f4f5]">Delete this league</p>
              <p className="text-xs text-[#52525b] mt-0.5">This action cannot be undone. All members and picks will be removed.</p>
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border shrink-0 ${styles[status] ?? styles.upcoming}`}>
      {labels[status] ?? status}
    </span>
  )
}
