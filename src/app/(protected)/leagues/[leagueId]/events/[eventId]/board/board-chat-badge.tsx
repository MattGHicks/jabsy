'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface BoardChatBadgeProps {
  leagueId: string
  initialCount: number
  currentUserId: string
}

export function BoardChatBadge({ leagueId, initialCount, currentUserId }: BoardChatBadgeProps) {
  const [count, setCount] = useState(initialCount)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Subscribe to new messages in this league to increment count live
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`board-chat-badge-${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'league_messages',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const newMsg = payload.new as { user_id: string }
          // Only count messages from other users
          if (newMsg.user_id !== currentUserId) {
            setCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [leagueId, currentUserId])

  if (count === 0) return null

  // Portal to document.body to escape the page-content transform
  // (CSS transforms create a new containing block, breaking position:fixed)
  const badge = (
    <Link
      href={`/leagues/${leagueId}?tab=chat`}
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#22c55e]/15 border border-[#22c55e]/25 backdrop-blur-sm shadow-lg shadow-black/40 hover:bg-[#22c55e]/25 hover:border-[#22c55e]/40 transition-all active:scale-95"
    >
      <MessageCircle className="w-4 h-4 text-[#22c55e]" />
      <span
        className="text-[12px] font-bold text-[#22c55e] tracking-wider uppercase"
        style={{ fontFamily: 'var(--font-barlow)' }}
      >
        {count > 99 ? '99+' : count} new
      </span>
    </Link>
  )

  if (!mounted) return null

  return createPortal(badge, document.body)
}
