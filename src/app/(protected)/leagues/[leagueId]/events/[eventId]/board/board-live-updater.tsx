'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface BoardLiveUpdaterProps {
  eventId: string
  isLive: boolean
}

/**
 * Invisible client component that subscribes to Supabase Realtime for
 * fight result updates and pick scoring changes on this event.
 *
 * When a change arrives it calls router.refresh() which re-runs the server
 * component and streams the updated leaderboard HTML to the page — no full
 * page reload, no scroll position loss, instant standings updates.
 *
 * Only active when the event is live. Cleans up the WebSocket on unmount.
 */
export function BoardLiveUpdater({ eventId, isLive }: BoardLiveUpdaterProps) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isLive) return

    const supabase = createClient()

    // Debounce refreshes so a burst of fight updates only causes one re-render
    const triggerRefresh = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => router.refresh(), 600)
    }

    const channel = supabase
      .channel(`board-live-${eventId}`)
      // Fight result entered (status → final, result_winner, etc.)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fights', filter: `event_id=eq.${eventId}` },
        triggerRefresh
      )
      // Pick points scored (points_earned updated after recalculate_event_picks)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'picks', filter: `event_id=eq.${eventId}` },
        triggerRefresh
      )
      .subscribe()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(channel)
    }
  }, [eventId, isLive, router])

  // No visible output — the LIVE badge in StickyStandings already shows status
  return null
}
