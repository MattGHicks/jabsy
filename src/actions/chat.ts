'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ChatMessage = {
  id: string
  league_id: string
  user_id: string
  content: string | null
  message_type: 'text' | 'image' | 'gif' | 'fight_card'
  image_url: string | null
  reply_to_id: string | null
  event_id: string | null
  created_at: string
  profiles: {
    username: string | null
    avatar_url: string | null
  } | null
  reply_to?: {
    id: string
    content: string | null
    message_type: 'text' | 'image' | 'gif' | 'fight_card'
    user_id: string
    profiles: {
      username: string | null
      avatar_url: string | null
    } | null
  } | null
}

export async function getMessages(
  leagueId: string,
  cursor?: string,
  limit = 50
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('league_messages')
    .select('id, league_id, user_id, content, message_type, image_url, reply_to_id, event_id, created_at, profiles(username, avatar_url)')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch messages:', error)
    return { messages: [], hasMore: false }
  }

  const hasMore = (data?.length ?? 0) > limit
  const messages = (data ?? []).slice(0, limit) as ChatMessage[]
  const reversed = messages.reverse()

  // Batch-fetch reply-to messages
  const replyIds = reversed.map((m) => m.reply_to_id).filter((id): id is string => id !== null)
  if (replyIds.length > 0) {
    const uniqueIds = [...new Set(replyIds)]
    const { data: replyData } = await supabase
      .from('league_messages')
      .select('id, content, message_type, user_id, profiles(username, avatar_url)')
      .in('id', uniqueIds)

    if (replyData) {
      const replyMap = new Map(replyData.map((r) => [r.id, r]))
      for (const msg of reversed) {
        if (msg.reply_to_id) {
          const ref = replyMap.get(msg.reply_to_id)
          msg.reply_to = ref ? (ref as ChatMessage['reply_to']) : null
        }
      }
    }
  }

  return { messages: reversed, hasMore }
}

export async function sendMessage(
  leagueId: string,
  content: string,
  replyToId?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 500) {
    return { error: 'Message must be between 1 and 500 characters.' }
  }

  const { data: insertedMsg, error } = await supabase
    .from('league_messages')
    .insert({
      league_id: leagueId,
      user_id: user.id,
      content: trimmed,
      message_type: 'text' as const,
      reply_to_id: replyToId ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to send message:', error)
    return { error: 'Failed to send message.' }
  }

  // Async link preview fetch (fire and forget)
  if (insertedMsg) {
    const urls = trimmed.match(URL_REGEX)
    if (urls && urls.length > 0) {
      // Only preview the first URL
      fetchAndStoreLinkPreview(insertedMsg.id, urls[0]).catch(() => {})
    }
  }

  return {}
}

export async function sendGifMessage(
  leagueId: string,
  gifUrl: string,
  caption?: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!gifUrl) return { error: 'GIF URL is required.' }

  const { error } = await supabase
    .from('league_messages')
    .insert({
      league_id: leagueId,
      user_id: user.id,
      content: caption?.trim() || null,
      message_type: 'gif' as const,
      image_url: gifUrl,
    })

  if (error) {
    console.error('Failed to send GIF:', error)
    return { error: 'Failed to send GIF.' }
  }

  return {}
}

export async function sendImageMessage(
  leagueId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const file = formData.get('image') as File | null
  if (!file || file.size === 0) return { error: 'No image selected.' }

  // Validate file
  const maxSize = 5 * 1024 * 1024 // 5MB
  if (file.size > maxSize) return { error: 'Image must be under 5MB.' }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedTypes.includes(file.type)) return { error: 'Only JPEG, PNG, WebP, and GIF images are allowed.' }

  // Upload to storage
  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${user.id}/${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('chat-images')
    .upload(fileName, file)

  if (uploadError) {
    console.error('Upload failed:', uploadError)
    return { error: 'Failed to upload image.' }
  }

  const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName)
  const caption = (formData.get('caption') as string)?.trim() || null

  const { error } = await supabase
    .from('league_messages')
    .insert({
      league_id: leagueId,
      user_id: user.id,
      content: caption,
      message_type: 'image' as const,
      image_url: urlData.publicUrl,
    })

  if (error) {
    console.error('Failed to send image message:', error)
    return { error: 'Failed to send image.' }
  }

  return {}
}

export async function deleteMessage(
  messageId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('league_messages')
    .delete()
    .eq('id', messageId)
    .eq('user_id', user.id)

  if (error) {
    console.error('Failed to delete message:', error)
    return { error: 'Failed to delete message.' }
  }

  return {}
}

// ── Fight Card Share ──────────────────────────────────────────────

export type FightCardFight = {
  id: string
  bout_order: number
  red_name: string
  blue_name: string
  weight_class: string | null
  is_main_event: boolean
  status: string
}

export async function getLeagueEventFights(
  leagueId: string,
  eventId: string
): Promise<{ event: { id: string; name: string; start_time: string } | null; fights: FightCardFight[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify event belongs to this league
  const { data: leagueEvent } = await supabase
    .from('league_events')
    .select('event_id, events(id, name, start_time)')
    .eq('league_id', leagueId)
    .eq('event_id', eventId)
    .single()

  if (!leagueEvent?.events) return { event: null, fights: [] }

  const { data: fights } = await supabase
    .from('fights')
    .select('id, bout_order, red_name, blue_name, weight_class, is_main_event, status')
    .eq('event_id', eventId)
    .order('bout_order', { ascending: true })

  const event = leagueEvent.events as unknown as { id: string; name: string; start_time: string }
  return { event, fights: (fights ?? []) as FightCardFight[] }
}

export async function sendFightCardMessage(
  leagueId: string,
  eventId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('league_messages')
    .insert({
      league_id: leagueId,
      user_id: user.id,
      message_type: 'fight_card' as const,
      event_id: eventId,
    })

  if (error) {
    console.error('Failed to send fight card:', error)
    return { error: 'Failed to share fight card.' }
  }

  return {}
}

// ── Unread / Read Tracking ────────────────────────────────────────

export async function getUnreadCount(leagueId: string): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0

  // Get last_read_at
  const { data: readRow } = await supabase
    .from('league_chat_reads')
    .select('last_read_at')
    .eq('user_id', user.id)
    .eq('league_id', leagueId)
    .maybeSingle()

  let query = supabase
    .from('league_messages')
    .select('id', { count: 'exact', head: true })
    .eq('league_id', leagueId)
    .neq('user_id', user.id)

  if (readRow?.last_read_at) {
    query = query.gt('created_at', readRow.last_read_at)
  }

  const { count } = await query
  return count ?? 0
}

export async function getUnreadCounts(leagueIds: string[]): Promise<Record<string, number>> {
  if (leagueIds.length === 0) return {}
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  // Fetch all read timestamps for the user
  const { data: readRows } = await supabase
    .from('league_chat_reads')
    .select('league_id, last_read_at')
    .eq('user_id', user.id)
    .in('league_id', leagueIds)

  const readMap: Record<string, string> = {}
  for (const r of readRows ?? []) {
    readMap[r.league_id] = r.last_read_at
  }

  // Count unread messages per league in parallel
  const counts = await Promise.all(
    leagueIds.map(async (lid) => {
      let query = supabase
        .from('league_messages')
        .select('id', { count: 'exact', head: true })
        .eq('league_id', lid)
        .neq('user_id', user.id)

      if (readMap[lid]) {
        query = query.gt('created_at', readMap[lid])
      }

      const { count } = await query
      return [lid, count ?? 0] as const
    })
  )

  return Object.fromEntries(counts)
}

export async function markChatRead(leagueId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('league_chat_reads')
    .upsert(
      { user_id: user.id, league_id: leagueId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,league_id' }
    )
}

// ── Reactions ──────────────────────────────────────────────────────

export type ReactionEmoji = 'fire' | 'thumbsup' | 'laugh' | 'skull' | 'trophy'

export type ReactionGroup = {
  emoji: ReactionEmoji
  count: number
  userIds: string[]
}

export async function toggleReaction(
  messageId: string,
  emoji: ReactionEmoji
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    // Remove it
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('id', existing.id)
    if (error) {
      console.error('Failed to remove reaction:', error)
      return { error: 'Failed to remove reaction.' }
    }
  } else {
    // Add it
    const { error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: user.id, emoji })
    if (error) {
      console.error('Failed to add reaction:', error)
      return { error: 'Failed to add reaction.' }
    }
  }

  return {}
}

export async function getReactions(
  messageIds: string[]
): Promise<Record<string, ReactionGroup[]>> {
  if (messageIds.length === 0) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji')
    .in('message_id', messageIds)

  if (error || !data) return {}

  // Group by message_id + emoji
  const result: Record<string, ReactionGroup[]> = {}
  for (const row of data) {
    if (!result[row.message_id]) result[row.message_id] = []
    const groups = result[row.message_id]
    const existing = groups.find((g) => g.emoji === row.emoji)
    if (existing) {
      existing.count++
      existing.userIds.push(row.user_id)
    } else {
      groups.push({ emoji: row.emoji as ReactionEmoji, count: 1, userIds: [row.user_id] })
    }
  }

  return result
}

// ── Link Previews ──────────────────────────────────────────────────

export type LinkPreview = {
  id: string
  message_id: string
  url: string
  title: string | null
  description: string | null
  image_url: string | null
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

export async function fetchAndStoreLinkPreview(messageId: string, url: string): Promise<void> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'bot' },
    })
    clearTimeout(timeout)

    if (!res.ok) return
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) return

    const html = await res.text()

    // Parse OG tags
    const getOg = (property: string): string | null => {
      const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'))
        ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, 'i'))
      return match?.[1] ? decodeHtmlEntities(match[1]) : null
    }

    const rawTitle = getOg('og:title') ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? null
    const title = rawTitle ? decodeHtmlEntities(rawTitle) : null
    const description = getOg('og:description') ?? getOg('description')
    const imageUrl = getOg('og:image')

    if (!title && !description && !imageUrl) return

    const adminClient = createAdminClient()
    await adminClient
      .from('message_link_previews')
      .upsert(
        {
          message_id: messageId,
          url,
          title: title?.slice(0, 200) ?? null,
          description: description?.slice(0, 500) ?? null,
          image_url: imageUrl ?? null,
        },
        { onConflict: 'message_id,url' }
      )
  } catch {
    // Silent fail — link preview is non-critical
  }
}

export async function getLinkPreviews(
  messageIds: string[]
): Promise<Record<string, LinkPreview[]>> {
  if (messageIds.length === 0) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('message_link_previews')
    .select('id, message_id, url, title, description, image_url')
    .in('message_id', messageIds)

  if (error || !data) return {}

  const result: Record<string, LinkPreview[]> = {}
  for (const row of data) {
    if (!result[row.message_id]) result[row.message_id] = []
    result[row.message_id].push(row as LinkPreview)
  }
  return result
}
