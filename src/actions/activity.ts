'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ActivityItem = {
  id: string
  type: 'member_joined' | 'picks_submitted' | 'event_completed'
  userId: string
  username: string | null
  avatarUrl: string | null
  timestamp: string
  meta: {
    eventName?: string
    eventId?: string
    pickCount?: number
  }
}

export async function getLeagueActivity(leagueId: string): Promise<ActivityItem[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const activities: ActivityItem[] = []

  // 1. Member joins
  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, joined_at, profiles(username, avatar_url)')
    .eq('league_id', leagueId)
    .order('joined_at', { ascending: false })

  for (const m of members ?? []) {
    const profile = m.profiles as { username: string | null; avatar_url: string | null } | null
    activities.push({
      id: `join-${m.user_id}`,
      type: 'member_joined',
      userId: m.user_id,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      timestamp: m.joined_at,
      meta: {},
    })
  }

  // 2. Get league events for context
  const { data: leagueEvents } = await supabase
    .from('league_events')
    .select('event_id, events(id, name, status, updated_at)')
    .eq('league_id', leagueId)

  const eventIds = (leagueEvents ?? []).map(le => le.event_id)
  const eventNameMap: Record<string, string> = {}
  for (const le of leagueEvents ?? []) {
    const ev = le.events as { id: string; name: string; status: string; updated_at: string } | null
    if (ev) eventNameMap[le.event_id] = ev.name
  }

  // Build a profile lookup from members
  const profileMap: Record<string, { username: string | null; avatarUrl: string | null }> = {}
  for (const m of members ?? []) {
    const profile = m.profiles as { username: string | null; avatar_url: string | null } | null
    profileMap[m.user_id] = { username: profile?.username ?? null, avatarUrl: profile?.avatar_url ?? null }
  }

  if (eventIds.length > 0) {
    // 3. Pick submissions — group by user + event
    const { data: picks } = await supabase
      .from('picks')
      .select('user_id, event_id, updated_at')
      .eq('league_id', leagueId)
      .in('event_id', eventIds)

    const grouped: Record<string, { userId: string; eventId: string; latestAt: string; count: number }> = {}
    for (const p of picks ?? []) {
      const key = `${p.user_id}-${p.event_id}`
      if (!grouped[key]) {
        grouped[key] = {
          userId: p.user_id,
          eventId: p.event_id,
          latestAt: p.updated_at,
          count: 0,
        }
      }
      grouped[key].count++
      if (p.updated_at > grouped[key].latestAt) {
        grouped[key].latestAt = p.updated_at
      }
    }

    for (const [key, g] of Object.entries(grouped)) {
      const prof = profileMap[g.userId]
      activities.push({
        id: `picks-${key}`,
        type: 'picks_submitted',
        userId: g.userId,
        username: prof?.username ?? null,
        avatarUrl: prof?.avatarUrl ?? null,
        timestamp: g.latestAt,
        meta: {
          eventName: eventNameMap[g.eventId] ?? 'Event',
          eventId: g.eventId,
          pickCount: g.count,
        },
      })
    }

    // 4. Completed events
    for (const le of leagueEvents ?? []) {
      const ev = le.events as { id: string; name: string; status: string; updated_at: string } | null
      if (ev && ev.status === 'completed') {
        activities.push({
          id: `completed-${ev.id}`,
          type: 'event_completed',
          userId: '',
          username: null,
          avatarUrl: null,
          timestamp: ev.updated_at,
          meta: {
            eventName: ev.name,
            eventId: ev.id,
          },
        })
      }
    }
  }

  // Sort by most recent first, limit to 30
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return activities.slice(0, 30)
}
