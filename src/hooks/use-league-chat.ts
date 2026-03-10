'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getMessages,
  getReactions,
  getLinkPreviews,
  sendMessage as sendMessageAction,
  sendGifMessage as sendGifAction,
  sendImageMessage as sendImageAction,
  sendFightCardMessage as sendFightCardAction,
  deleteMessage as deleteMessageAction,
  toggleReaction as toggleReactionAction,
  type ChatMessage,
  type ReactionEmoji,
  type ReactionGroup,
  type LinkPreview,
} from '@/actions/chat'

interface UseLeagueChatOptions {
  leagueId: string
  currentUserId: string
}

export function useLeagueChat({ leagueId, currentUserId }: UseLeagueChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<Record<string, ReactionGroup[]>>({})
  const [linkPreviews, setLinkPreviews] = useState<Record<string, LinkPreview[]>>({})
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const initializedRef = useRef(false)

  // Load reactions for a set of message IDs
  const loadReactions = useCallback(async (msgIds: string[]) => {
    if (msgIds.length === 0) return
    const data = await getReactions(msgIds)
    setReactions((prev) => ({ ...prev, ...data }))
  }, [])

  // Load initial messages
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    async function load() {
      setIsLoading(true)
      const result = await getMessages(leagueId)
      setMessages(result.messages)
      setHasMore(result.hasMore)
      setIsLoading(false)
      // Load reactions and link previews for initial messages
      const ids = result.messages.map((m) => m.id)
      if (ids.length > 0) {
        const [reactionData, previewData] = await Promise.all([
          getReactions(ids),
          getLinkPreviews(ids),
        ])
        setReactions(reactionData)
        setLinkPreviews(previewData)
      }
    }
    load()
  }, [leagueId])

  // Subscribe to realtime changes
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`league-chat-${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'league_messages',
          filter: `league_id=eq.${leagueId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })

          // Fetch profile data for the message
          if (!newMsg.profiles) {
            const { data } = await supabase
              .from('league_messages')
              .select('id, league_id, user_id, content, message_type, image_url, reply_to_id, event_id, created_at, profiles(username, avatar_url)')
              .eq('id', newMsg.id)
              .single()

            if (data) {
              setMessages((prev) =>
                prev.map((m) => (m.id === data.id ? data as ChatMessage : m))
              )
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'league_messages',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id
          setMessages((prev) => prev.filter((m) => m.id !== deletedId))
          setReactions((prev) => {
            const next = { ...prev }
            delete next[deletedId]
            return next
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const row = payload.new as { message_id: string; user_id: string; emoji: ReactionEmoji }
          setReactions((prev) => {
            const groups = [...(prev[row.message_id] ?? [])]
            const existing = groups.find((g) => g.emoji === row.emoji)
            if (existing) {
              if (!existing.userIds.includes(row.user_id)) {
                existing.count++
                existing.userIds = [...existing.userIds, row.user_id]
              }
            } else {
              groups.push({ emoji: row.emoji, count: 1, userIds: [row.user_id] })
            }
            return { ...prev, [row.message_id]: groups }
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          const row = payload.old as { message_id: string; user_id: string; emoji: ReactionEmoji }
          setReactions((prev) => {
            const groups = (prev[row.message_id] ?? [])
              .map((g) => {
                if (g.emoji !== row.emoji) return g
                return {
                  ...g,
                  count: g.count - 1,
                  userIds: g.userIds.filter((id) => id !== row.user_id),
                }
              })
              .filter((g) => g.count > 0)
            return { ...prev, [row.message_id]: groups }
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_link_previews',
        },
        (payload) => {
          const row = payload.new as LinkPreview
          setLinkPreviews((prev) => ({
            ...prev,
            [row.message_id]: [...(prev[row.message_id] ?? []), row],
          }))
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, username } = payload.payload as { userId: string; username: string }
        if (userId === currentUserId) return
        setTypingUsers((prev) => ({
          ...prev,
          [userId]: { username, expiresAt: Date.now() + 3500 },
        }))
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [leagueId, currentUserId])

  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)

  // ── Typing indicator ──────────────────────────────────────────
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; expiresAt: number }>>({})
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up expired typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now()
        const next: typeof prev = {}
        for (const [id, info] of Object.entries(prev)) {
          if (info.expiresAt > now) next[id] = info
        }
        return Object.keys(next).length === Object.keys(prev).length ? prev : next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const sendTypingIndicator = useCallback((username: string) => {
    if (typingTimeoutRef.current) return // throttle: only send once per 2s
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, username },
    })
    typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null }, 2000)
  }, [currentUserId])

  const sendMessage = useCallback(async (content: string, replyToId?: string): Promise<{ error?: string }> => {
    setIsSending(true)
    const result = await sendMessageAction(leagueId, content, replyToId)
    setIsSending(false)
    return result
  }, [leagueId])

  const sendGif = useCallback(async (gifUrl: string, caption?: string): Promise<{ error?: string }> => {
    setIsSending(true)
    const result = await sendGifAction(leagueId, gifUrl, caption)
    setIsSending(false)
    return result
  }, [leagueId])

  const sendImage = useCallback(async (formData: FormData): Promise<{ error?: string }> => {
    setIsSending(true)
    const result = await sendImageAction(leagueId, formData)
    setIsSending(false)
    return result
  }, [leagueId])

  const sendFightCard = useCallback(async (eventId: string): Promise<{ error?: string }> => {
    setIsSending(true)
    const result = await sendFightCardAction(leagueId, eventId)
    setIsSending(false)
    return result
  }, [leagueId])

  const deleteMsg = useCallback(async (messageId: string): Promise<{ error?: string }> => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
    const result = await deleteMessageAction(messageId)
    if (result.error) {
      const fresh = await getMessages(leagueId)
      setMessages(fresh.messages)
      setHasMore(fresh.hasMore)
    }
    return result
  }, [leagueId])

  const toggleReaction = useCallback(async (messageId: string, emoji: ReactionEmoji): Promise<{ error?: string }> => {
    // Optimistic update
    setReactions((prev) => {
      const groups = [...(prev[messageId] ?? [])]
      const existing = groups.find((g) => g.emoji === emoji)
      if (existing && existing.userIds.includes(currentUserId)) {
        // Remove
        existing.count--
        existing.userIds = existing.userIds.filter((id) => id !== currentUserId)
        return { ...prev, [messageId]: groups.filter((g) => g.count > 0) }
      } else if (existing) {
        // Add to existing
        existing.count++
        existing.userIds = [...existing.userIds, currentUserId]
        return { ...prev, [messageId]: groups }
      } else {
        // New group
        groups.push({ emoji, count: 1, userIds: [currentUserId] })
        return { ...prev, [messageId]: groups }
      }
    })

    const result = await toggleReactionAction(messageId, emoji)
    if (result.error) {
      // Revert on error — reload reactions for this message
      await loadReactions([messageId])
    }
    return result
  }, [currentUserId, loadReactions])

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return
    setIsLoadingMore(true)
    const oldest = messages[0]
    if (!oldest) { setIsLoadingMore(false); return }
    const result = await getMessages(leagueId, oldest.created_at)
    setMessages((prev) => [...result.messages, ...prev])
    setHasMore(result.hasMore)
    setIsLoadingMore(false)
    // Load reactions and previews for newly loaded messages
    const ids = result.messages.map((m) => m.id)
    await loadReactions(ids)
    if (ids.length > 0) {
      const previewData = await getLinkPreviews(ids)
      setLinkPreviews((prev) => ({ ...prev, ...previewData }))
    }
  }, [leagueId, hasMore, isLoadingMore, messages, loadReactions])

  // Compute typing display names (exclude self)
  const typingNames = Object.values(typingUsers).map((t) => t.username)

  return {
    messages,
    reactions,
    linkPreviews,
    hasMore,
    isLoading,
    isSending,
    isLoadingMore,
    replyingTo,
    setReplyingTo,
    sendMessage,
    sendGif,
    sendImage,
    sendFightCard,
    deleteMessage: deleteMsg,
    toggleReaction,
    loadMore,
    currentUserId,
    typingNames,
    sendTypingIndicator,
  }
}
