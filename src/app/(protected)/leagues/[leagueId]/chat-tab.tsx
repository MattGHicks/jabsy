'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, ChevronUp, Trash2, MessageCircle, ImagePlus, X, Search, Flame, ThumbsUp, Laugh, Skull, Trophy, Reply, CornerUpRight, Globe, ArrowUpRight, Maximize2 } from 'lucide-react'
import type { ReactionEmoji, ReactionGroup, ChatMessage, LinkPreview } from '@/actions/chat'
import { cn, getInitials } from '@/lib/utils'
import { useLeagueChat } from '@/hooks/use-league-chat'

interface MemberInfo {
  id: string
  username: string | null
  avatar_url: string | null
}

interface LeagueEvent {
  id: string
  name: string
  status: string
}

interface ChatTabProps {
  leagueId: string
  currentUserId: string
  currentUserProfile: { username: string | null; avatar_url: string | null }
  members: MemberInfo[]
  leagueEvents: LeagueEvent[]
}

// ── GIF Picker (GIPHY API) ──────────────────────────────────────────
interface GiphyGif {
  id: string
  title: string
  images: {
    fixed_height_small: { url: string }
    fixed_height: { url: string }
    original: { url: string }
  }
}

const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? ''

function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [trending, setTrending] = useState<GiphyGif[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    inputRef.current?.focus()
    async function loadTrending() {
      try {
        const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=20&rating=pg-13`)
        const data = await res.json()
        setTrending(data.data ?? [])
      } catch { /* silent */ }
    }
    loadTrending()
  }, [])

  const searchGifs = useCallback(async (q: string) => {
    if (!q.trim()) { setGifs([]); return }
    setIsSearching(true)
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=pg-13`)
      const data = await res.json()
      setGifs(data.data ?? [])
    } catch { /* silent */ }
    setIsSearching(false)
  }, [])

  function handleInput(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchGifs(value), 350)
  }

  const displayGifs = query.trim() ? gifs : trending

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 sm:mx-3 z-20">
      <div className="rounded-xl bg-[#0e0e0e] border border-[#27272a] shadow-2xl shadow-black/50 overflow-hidden max-h-[340px] flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e1e1e]">
          <Search className="w-3.5 h-3.5 text-[#52525b] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Search GIFs..."
            className="flex-1 bg-transparent text-sm text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none"
          />
          <button onClick={onClose} className="p-1 rounded hover:bg-[#1e1e1e] text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-2">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-[#52525b] animate-spin" />
            </div>
          ) : displayGifs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-xs text-[#3f3f46]">{query ? 'No GIFs found' : 'Loading...'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {displayGifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => onSelect(gif.images.fixed_height.url)}
                  className="relative rounded-lg overflow-hidden aspect-square hover:ring-2 hover:ring-[#e11d48]/50 transition-all cursor-pointer group"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gif.images.fixed_height_small.url} alt={gif.title} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-[#1e1e1e] flex justify-end">
          <span className="text-[9px] text-[#3f3f46] uppercase tracking-wider">Powered by GIPHY</span>
        </div>
      </div>
    </div>
  )
}

// ── Image Preview ──────────────────────────────────────────────────
function ImagePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview, setPreview] = useState<string>('')

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!preview) return null

  return (
    <div className="relative mx-3 sm:mx-4 mb-2">
      <div className="relative inline-block rounded-lg overflow-hidden border border-[#27272a] max-w-[200px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="Upload preview" className="max-h-[120px] object-contain" />
        <button
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-[#e11d48] transition-colors cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <p className="text-[10px] text-[#3f3f46] mt-1 truncate max-w-[200px]">{file.name}</p>
    </div>
  )
}

// ── Lightbox ───────────────────────────────────────────────────────
function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white cursor-pointer">
        <X className="w-5 h-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}

// ── Username color generator (consistent per-user) ─────────────────
const USERNAME_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#a855f7', '#14b8a6',
  '#f97316', '#ec4899', '#06b6d4', '#84cc16', '#8b5cf6',
]

function getUserColor(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USERNAME_COLORS[Math.abs(hash) % USERNAME_COLORS.length]
}

// ── Link Preview Card ──────────────────────────────────────────────
function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  if (!preview.title && !preview.description) return null
  let hostname = ''
  try { hostname = new URL(preview.url).hostname.replace(/^www\./, '') } catch { hostname = preview.url }
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 block max-w-[340px] group/link"
      style={{ textDecoration: 'none' }}
    >
      <div className="flex rounded-xl overflow-hidden border border-[#1e1e1e] bg-[#111111] hover:border-[#e11d48]/30 hover:bg-[#141414] transition-all duration-200 shadow-lg shadow-black/20">
        {/* Red accent bar */}
        <div className="w-[3px] shrink-0 bg-[#e11d48] opacity-70 group-hover/link:opacity-100 transition-opacity" />

        <div className="flex-1 min-w-0">
          {/* Image */}
          {preview.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.image_url}
              alt=""
              className="w-full h-[120px] object-cover opacity-90 group-hover/link:opacity-100 transition-opacity"
              loading="lazy"
            />
          )}

          <div className="px-3 py-2.5">
            {/* Hostname row */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1 min-w-0">
                <Globe className="w-2.5 h-2.5 text-[#e11d48]/60 shrink-0" />
                <span className="text-[9px] text-[#e11d48]/70 group-hover/link:text-[#e11d48] uppercase tracking-[0.15em] truncate transition-colors" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{hostname}</span>
              </div>
              <ArrowUpRight className="w-3 h-3 text-[#3f3f46] group-hover/link:text-[#e11d48] transition-colors shrink-0" />
            </div>

            {preview.title && (
              <p className="text-[13px] text-[#e4e4e7] leading-snug line-clamp-2 group-hover/link:text-white transition-colors" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                {preview.title}
              </p>
            )}
            {preview.description && (
              <p className="text-[10px] text-[#52525b] leading-relaxed mt-1 line-clamp-2">
                {preview.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </a>
  )
}

// ── Mention rendering ──────────────────────────────────────────────
function renderTextWithMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\w+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="text-[#22c55e] font-semibold">{part}</span>
      )
    }
    return part
  })
}

// ── Emoji Reaction Helpers ──────────────────────────────────────────
const REACTION_EMOJIS: { emoji: ReactionEmoji; icon: typeof Flame; label: string }[] = [
  { emoji: 'fire', icon: Flame, label: '🔥' },
  { emoji: 'thumbsup', icon: ThumbsUp, label: '👍' },
  { emoji: 'laugh', icon: Laugh, label: '😂' },
  { emoji: 'skull', icon: Skull, label: '💀' },
  { emoji: 'trophy', icon: Trophy, label: '🏆' },
]

const EMOJI_DISPLAY: Record<ReactionEmoji, string> = {
  fire: '🔥',
  thumbsup: '👍',
  laugh: '😂',
  skull: '💀',
  trophy: '🏆',
}

function ReactionPills({
  reactions,
  currentUserId,
  onToggle,
}: {
  reactions: ReactionGroup[]
  currentUserId: string
  onToggle: (emoji: ReactionEmoji) => void
}) {
  if (reactions.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r) => {
        const reacted = r.userIds.includes(currentUserId)
        return (
          <button
            key={r.emoji}
            onClick={() => onToggle(r.emoji)}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-all cursor-pointer border',
              reacted
                ? 'bg-[#e11d48]/10 border-[#e11d48]/30 text-[#f4f4f5] hover:bg-[#e11d48]/20'
                : 'bg-[#1e1e1e] border-[#27272a] text-[#a1a1aa] hover:bg-[#27272a] hover:border-[#3f3f46]'
            )}
          >
            <span className="text-[12px] leading-none">{EMOJI_DISPLAY[r.emoji]}</span>
            <span className="font-semibold tabular-nums">{r.count}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Main Chat Component ────────────────────────────────────────────
export function ChatTab({ leagueId, currentUserId, currentUserProfile, members, leagueEvents }: ChatTabProps) {
  const {
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
    deleteMessage,
    toggleReaction,
    loadMore,
    typingNames,
    sendTypingIndicator,
    sendFightCard,
  } = useLeagueChat({ leagueId, currentUserId })

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activeMsgId, setActiveMsgId] = useState<string | null>(null)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [showEventPicker, setShowEventPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const shouldScrollRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mention autocomplete filtering
  const filteredMembers = mentionQuery !== null
    ? members.filter((m) => m.username && m.username.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : []

  function handleInputChange(value: string) {
    setInput(value)
    // Broadcast typing indicator
    if (value.trim()) sendTypingIndicator(currentUserProfile.username ?? 'Someone')
    // Detect @mention trigger
    const textarea = textareaRef.current
    if (textarea) {
      const cursorPos = textarea.selectionStart
      const textBeforeCursor = value.slice(0, cursorPos)
      const atMatch = textBeforeCursor.match(/@(\w*)$/)
      if (atMatch) {
        setMentionQuery(atMatch[1])
        setMentionIndex(0)
      } else {
        setMentionQuery(null)
      }
    }
  }

  function insertMention(username: string) {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursorPos = textarea.selectionStart
    const textBeforeCursor = input.slice(0, cursorPos)
    const atIndex = textBeforeCursor.lastIndexOf('@')
    if (atIndex === -1) return
    const before = input.slice(0, atIndex)
    const after = input.slice(cursorPos)
    const newInput = `${before}@${username} ${after}`
    setInput(newInput)
    setMentionQuery(null)
    // Restore cursor position after React re-render
    setTimeout(() => {
      const newPos = atIndex + username.length + 2 // @username + space
      textarea.setSelectionRange(newPos, newPos)
      textarea.focus()
    }, 0)
  }

  // Dismiss action bar when tapping outside on mobile
  useEffect(() => {
    if (!activeMsgId) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement
      if (!target.closest(`#msg-${activeMsgId}`)) {
        setActiveMsgId(null)
      }
    }
    // Use a slight delay so the current click doesn't immediately dismiss
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [activeMsgId])

  // Auto-scroll to bottom on new messages — use container scroll to avoid moving outer page
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && shouldScrollRef.current) {
      const el = messagesContainerRef.current
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
    prevMessageCountRef.current = messages.length
  }, [messages.length])

  // Initial scroll to bottom — use instant for first load, container scroll instead of scrollIntoView
  // to avoid moving the entire page
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      const el = messagesContainerRef.current
      if (el) el.scrollTop = el.scrollHeight
    }
  }, [isLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    const el = messagesContainerRef.current
    if (!el) return
    shouldScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  async function handleSend() {
    setError(null)
    shouldScrollRef.current = true
    if (pendingImage) {
      const fd = new FormData()
      fd.set('image', pendingImage)
      if (input.trim()) fd.set('caption', input.trim())
      setPendingImage(null)
      setInput('')
      const result = await sendImage(fd)
      if (result.error) setError(result.error)
      return
    }
    const trimmed = input.trim()
    if (!trimmed || isSending) return
    const replyId = replyingTo?.id
    setInput('')
    setReplyingTo(null)
    const result = await sendMessage(trimmed, replyId)
    if (result.error) { setError(result.error); setInput(trimmed) }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Mention autocomplete keyboard nav
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault()
        const member = filteredMembers[mentionIndex]
        if (member?.username) insertMention(member.username)
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  async function handleGifSelect(gifUrl: string) {
    setShowGifPicker(false)
    setError(null)
    shouldScrollRef.current = true
    const result = await sendGif(gifUrl)
    if (result.error) setError(result.error)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB.'); return }
    setPendingImage(file)
    setShowGifPicker(false)
    e.target.value = ''
  }

  async function handleDelete(messageId: string) {
    const result = await deleteMessage(messageId)
    if (result.error) setError(result.error)
  }

  async function handleShareFightCard(eventId: string) {
    setShowEventPicker(false)
    setError(null)
    shouldScrollRef.current = true
    const result = await sendFightCard(eventId)
    if (result.error) setError(result.error)
  }

  // ── Date separator logic ──────────────────────────────────────────
  function getDateLabel(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' })
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined })
  }

  function shouldShowDateSeparator(index: number): boolean {
    if (index === 0) return true
    const curr = new Date(messages[index].created_at)
    const prev = new Date(messages[index - 1].created_at)
    return curr.toDateString() !== prev.toDateString()
  }

  // Is this the start of a new "message group"? (different user or >7min gap)
  function isGroupStart(index: number): boolean {
    if (index === 0) return true
    const curr = messages[index]
    const prev = messages[index - 1]
    if (curr.user_id !== prev.user_id) return true
    const gap = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()
    return gap > 7 * 60 * 1000
  }

  function formatMsgTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#52525b] animate-spin mb-3" />
        <p className="text-sm text-[#52525b]">Loading chat...</p>
      </div>
    )
  }

  const canSend = (input.trim() || pendingImage) && !isSending

  return (
    <div className="flex flex-col h-[600px] sm:h-[700px] rounded-xl bg-[#0a0a0a] border border-[#1e1e1e] overflow-hidden">
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-0"
      >
        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center pb-3">
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider text-[#52525b] hover:text-[#a1a1aa] bg-[#111111] border border-[#1e1e1e] hover:border-[#27272a] transition-colors cursor-pointer"
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
            >
              {isLoadingMore ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronUp className="w-3 h-3" />}
              Load older messages
            </button>
          </div>
        )}

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#22c55e]/[0.06] border border-[#22c55e]/10 flex items-center justify-center mb-4">
              <MessageCircle className="w-6 h-6 text-[#22c55e]/40" />
            </div>
            <p className="text-sm text-[#71717a] mb-1" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>No messages yet</p>
            <p className="text-xs text-[#3f3f46]">Break the ice — say something!</p>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => {
          const isMe = msg.user_id === currentUserId
          const groupStart = isGroupStart(i)
          const showDate = shouldShowDateSeparator(i)
          const profile = msg.profiles ?? (isMe ? currentUserProfile : null)
          const isMedia = msg.message_type === 'gif' || msg.message_type === 'image'
          const nameColor = isMe ? '#e11d48' : getUserColor(msg.user_id)

          return (
            <div key={msg.id}>
              {/* ── Date separator ── */}
              {showDate && (
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-[#1e1e1e]" />
                  <span
                    className="text-[10px] text-[#52525b] uppercase tracking-widest shrink-0"
                    style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
                  >
                    {getDateLabel(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-[#1e1e1e]" />
                </div>
              )}

              {/* ── Group start spacer ── */}
              {groupStart && !showDate && <div className="h-3" />}

              {/* ── Message row ── */}
              <div
                id={`msg-${msg.id}`}
                className="group relative flex gap-3 py-[1px] hover:bg-[#111111]/60 rounded px-2 -mx-2 transition-colors"
                onMouseEnter={() => setActiveMsgId(msg.id)}
                onMouseLeave={() => setActiveMsgId(null)}
                onClick={(e) => {
                  // On touch devices, tap to toggle action bar
                  // Only toggle if not clicking an interactive element
                  const target = e.target as HTMLElement
                  if (target.closest('button, a, [role="button"]')) return
                  setActiveMsgId((prev) => prev === msg.id ? null : msg.id)
                }}
              >
                {/* Avatar gutter — 36px wide */}
                <div className="w-9 shrink-0">
                  {groupStart ? (
                    <div className="w-9 h-9 rounded-full bg-[#141414] border border-[#27272a] overflow-hidden mt-0.5">
                      {profile?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] font-bold text-[#52525b] flex items-center justify-center w-full h-full">
                          {getInitials(profile?.username ?? 'U')}
                        </span>
                      )}
                    </div>
                  ) : (
                    /* Hover timestamp in the avatar gutter for continuation messages */
                    <span className="text-[9px] text-[#3f3f46] opacity-0 group-hover:opacity-100 transition-opacity leading-[20px] flex items-center justify-center h-full select-none">
                      {formatMsgTime(msg.created_at)}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Name + time header (only on group start) */}
                  {groupStart && (
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-[13px] leading-tight"
                        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, color: nameColor }}
                      >
                        {profile?.username ?? 'Unknown'}
                      </span>
                      <span className="text-[10px] text-[#3f3f46] leading-tight">
                        {formatMsgTime(msg.created_at)}
                      </span>
                    </div>
                  )}

                  {/* Inline reply quote */}
                  {msg.reply_to && (
                    <button
                      onClick={() => {
                        const el = document.getElementById(`msg-${msg.reply_to_id}`)
                        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-1', 'ring-[#22c55e]/30'); setTimeout(() => el.classList.remove('ring-1', 'ring-[#22c55e]/30'), 1500) }
                      }}
                      className="flex items-start gap-2 mt-0.5 mb-0.5 pl-2.5 border-l-2 border-[#27272a] rounded-r text-[11px] text-[#52525b] cursor-pointer hover:bg-[#141414] hover:text-[#71717a] transition-colors py-0.5 pr-2 max-w-[400px]"
                    >
                      <CornerUpRight className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="truncate">
                        <span className="font-semibold" style={{ color: msg.reply_to.user_id === currentUserId ? '#e11d48' : getUserColor(msg.reply_to.user_id) }}>
                          {msg.reply_to.profiles?.username ?? 'Unknown'}
                        </span>
                        {' '}
                        {msg.reply_to.message_type !== 'text' ? (
                          <span className="italic">{msg.reply_to.message_type === 'gif' ? 'sent a GIF' : msg.reply_to.message_type === 'fight_card' ? 'shared a fight card' : 'sent an image'}</span>
                        ) : (
                          msg.reply_to.content ?? ''
                        )}
                      </span>
                    </button>
                  )}

                  {/* Message body */}
                  <div className="relative">
                    <div className="flex items-start gap-1.5">
                      {msg.message_type === 'fight_card' && msg.event_id ? (
                        <a
                          href={`/leagues/${leagueId}/events/${msg.event_id}`}
                          className="mt-1 block rounded-lg border border-[#e11d48]/20 bg-[#e11d48]/[0.04] hover:bg-[#e11d48]/[0.08] transition-colors px-4 py-3 max-w-[320px] group/card"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Trophy className="w-4 h-4 text-[#e11d48] shrink-0" />
                            <span className="text-[12px] text-[#e11d48] uppercase tracking-wider font-bold" style={{ fontFamily: 'var(--font-barlow)' }}>
                              Fight Card
                            </span>
                          </div>
                          <p className="text-[14px] text-[#f4f4f5] font-bold group-hover/card:text-white transition-colors" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                            {leagueEvents.find((e) => e.id === msg.event_id)?.name ?? 'Event'}
                          </p>
                          <p className="text-[10px] text-[#52525b] mt-1">Tap to view picks →</p>
                        </a>
                      ) : isMedia ? (
                        <div className="flex flex-col gap-1.5 mt-1">
                          <button
                            onClick={() => msg.image_url && setLightboxSrc(msg.image_url)}
                            className="group/img relative rounded-xl overflow-hidden cursor-pointer max-w-[260px] sm:max-w-[300px] border border-[#1e1e1e] shadow-lg shadow-black/30 hover:border-[#27272a] transition-all duration-200"
                            style={{ display: 'block' }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.image_url ?? ''}
                              alt=""
                              className="w-full max-h-[220px] object-contain bg-[#0d0d0d] transition-all duration-200 group-hover/img:brightness-110"
                              loading="lazy"
                            />
                            {/* GIF badge */}
                            {msg.message_type === 'gif' && (
                              <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest bg-black/70 text-white backdrop-blur-sm border border-white/10" style={{ fontFamily: 'var(--font-barlow)' }}>
                                GIF
                              </span>
                            )}
                            {/* Expand icon for images */}
                            {msg.message_type === 'image' && (
                              <span className="absolute top-2 right-2 w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity border border-white/10">
                                <Maximize2 className="w-3 h-3 text-white" />
                              </span>
                            )}
                          </button>
                          {msg.content && (
                            <p className="text-[12px] text-[#a1a1aa] leading-relaxed break-words italic">{renderTextWithMentions(msg.content)}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-[13px] text-[#d4d4d8] leading-[1.4] break-words mt-px">{msg.content ? renderTextWithMentions(msg.content) : null}</p>
                      )}
                    </div>

                    {/* Action bar — hover on desktop, tap on mobile */}
                    {activeMsgId === msg.id && (
                      <div className="absolute -top-3 right-0 flex items-center gap-px bg-[#141414] border border-[#27272a] rounded-md shadow-lg shadow-black/30 z-10">
                        {REACTION_EMOJIS.map(({ emoji, label }) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="w-7 h-7 flex items-center justify-center text-[14px] hover:bg-[#1e1e1e] transition-colors cursor-pointer first:rounded-l-md"
                            title={label}
                          >
                            {label}
                          </button>
                        ))}
                        <button
                          onClick={() => setReplyingTo(msg)}
                          className="w-7 h-7 flex items-center justify-center text-[#52525b] hover:text-[#22c55e] hover:bg-[#1e1e1e] transition-colors cursor-pointer border-l border-[#27272a]"
                          title="Reply"
                        >
                          <Reply className="w-3 h-3" />
                        </button>
                        {isMe && (
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="w-7 h-7 flex items-center justify-center text-[#52525b] hover:text-[#e11d48] hover:bg-[#1e1e1e] transition-colors cursor-pointer rounded-r-md border-l border-[#27272a]"
                            title="Delete message"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Reaction pills */}
                    <ReactionPills
                      reactions={reactions[msg.id] ?? []}
                      currentUserId={currentUserId}
                      onToggle={(emoji) => toggleReaction(msg.id, emoji)}
                    />

                    {/* Link previews */}
                    {(linkPreviews[msg.id] ?? []).map((preview) => (
                      <LinkPreviewCard key={preview.id} preview={preview} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-1.5 bg-[#e11d48]/5 border-t border-[#e11d48]/20 flex items-center justify-between">
          <p className="text-[11px] text-[#e11d48]">{error}</p>
          <button onClick={() => setError(null)} className="text-[#e11d48]/50 hover:text-[#e11d48] cursor-pointer"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Image preview */}
      {pendingImage && (
        <ImagePreview file={pendingImage} onRemove={() => setPendingImage(null)} />
      )}

      {/* Reply preview bar */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#111111] border-t border-[#1e1e1e]">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="w-0.5 h-6 bg-[#22c55e] rounded-full shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-[#22c55e] font-semibold" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                Replying to {replyingTo.profiles?.username ?? 'Unknown'}
              </p>
              <p className="text-[11px] text-[#52525b] truncate">
                {replyingTo.message_type !== 'text'
                  ? (replyingTo.message_type === 'gif' ? 'GIF' : 'Image')
                  : (replyingTo.content ?? '')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded hover:bg-[#1e1e1e] text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="px-3 py-1 border-t border-[#1e1e1e] bg-[#0c0c0c]">
          <p className="text-[11px] text-[#52525b] flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-[#52525b] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-[#52525b] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-[#52525b] animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span className="text-[#71717a] font-medium">
              {typingNames.length === 1
                ? `${typingNames[0]} is typing`
                : typingNames.length === 2
                  ? `${typingNames[0]} and ${typingNames[1]} are typing`
                  : `${typingNames[0]} and ${typingNames.length - 1} others are typing`}
            </span>
          </p>
        </div>
      )}

      {/* Input bar */}
      <div className="relative border-t border-[#1e1e1e] bg-[#0e0e0e]">
        {showGifPicker && (
          <GifPicker onSelect={handleGifSelect} onClose={() => setShowGifPicker(false)} />
        )}

        {showEventPicker && (
          <div className="absolute bottom-full left-0 right-0 mb-2 mx-2 sm:mx-3 z-20">
            <div className="rounded-xl bg-[#0e0e0e] border border-[#27272a] shadow-2xl shadow-black/50 overflow-hidden max-h-[240px] flex flex-col">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1e1e1e]">
                <span className="text-[11px] text-[#71717a] uppercase tracking-wider font-bold" style={{ fontFamily: 'var(--font-barlow)' }}>Share Fight Card</span>
                <button onClick={() => setShowEventPicker(false)} className="p-1 rounded hover:bg-[#1e1e1e] text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-1.5">
                {leagueEvents.map((event) => {
                  const statusStyle = event.status === 'live' ? 'text-[#e11d48]' : event.status === 'upcoming' ? 'text-blue-400' : 'text-[#52525b]'
                  return (
                    <button
                      key={event.id}
                      onClick={() => handleShareFightCard(event.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1e1e1e] transition-colors cursor-pointer text-left"
                    >
                      <Trophy className={cn('w-4 h-4 shrink-0', statusStyle)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-[#f4f4f5] font-medium truncate">{event.name}</p>
                        <p className={cn('text-[10px] uppercase tracking-wider font-bold', statusStyle)} style={{ fontFamily: 'var(--font-barlow)' }}>
                          {event.status}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="px-2.5 sm:px-3 py-2 flex items-center gap-2">
          {/* Attachment buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#161616] transition-colors cursor-pointer"
              title="Attach image"
            >
              <ImagePlus className="w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setShowGifPicker(!showGifPicker)}
              className={cn(
                'h-9 px-2.5 rounded-xl flex items-center justify-center text-[11px] font-black tracking-wide transition-colors cursor-pointer',
                showGifPicker
                  ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20'
                  : 'text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#161616]'
              )}
              title="Send GIF"
            >
              GIF
            </button>
            {leagueEvents.length > 0 && (
              <button
                onClick={() => { setShowEventPicker(!showEventPicker); setShowGifPicker(false) }}
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer',
                  showEventPicker
                    ? 'bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20'
                    : 'text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#161616]'
                )}
                title="Share fight card"
              >
                <Trophy className="w-[18px] h-[18px]" />
              </button>
            )}
          </div>

          {/* Text input */}
          <div className="relative flex-1">
            {/* Mention autocomplete dropdown */}
            {mentionQuery !== null && filteredMembers.length > 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#141414] border border-[#27272a] rounded-lg shadow-xl shadow-black/40 overflow-hidden z-20 max-h-[200px] overflow-y-auto">
                {filteredMembers.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => m.username && insertMention(m.username)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer',
                      i === mentionIndex ? 'bg-[#1e1e1e]' : 'hover:bg-[#1a1a1a]'
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0">
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] font-bold text-[#52525b] flex items-center justify-center w-full h-full">
                          {getInitials(m.username ?? 'U')}
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] text-[#f4f4f5] font-medium truncate">{m.username}</span>
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowGifPicker(false)}
              placeholder={pendingImage ? 'Add a caption...' : 'Message...'}
              maxLength={500}
              rows={1}
              className="w-full resize-none bg-[#111111] border border-[#1e1e1e] rounded-xl px-3 py-2 text-[16px] sm:text-[13px] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#27272a] transition-colors min-h-[36px] max-h-[100px]"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          </div>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer',
              canSend
                ? 'bg-[#e11d48] text-white hover:bg-[#be123c] shadow-lg shadow-[#e11d48]/20'
                : 'bg-[#161616] text-[#3f3f46] cursor-not-allowed'
            )}
          >
            {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>

        {input.length > 400 && (
          <div className="px-3 pb-1">
            <p className={cn('text-[9px] text-right', input.length >= 500 ? 'text-[#e11d48]' : 'text-[#3f3f46]')}>
              {input.length}/500
            </p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  )
}
