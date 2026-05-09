'use client'

import { useState } from 'react'
import { Share2, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShareButtonProps {
  /**
   * The share code (league.share_code or invite.code). Required.
   */
  code: string
  /**
   * Optional event ID — if set, the share URL deep-links to that event after join.
   */
  eventId?: string
  /**
   * Title shown in the native share sheet (mobile / supporting browsers).
   */
  shareTitle: string
  /**
   * Body text shown in the native share sheet.
   */
  shareText: string
  /**
   * 'icon' renders just the share glyph; 'pill' renders icon + label; 'inline' is a small inline button.
   */
  variant?: 'icon' | 'pill' | 'inline'
  /**
   * Optional class to override the default button styling.
   */
  className?: string
  label?: string
}

function buildShareUrl(code: string, eventId?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return eventId
    ? `${origin}/invite/${code}?event=${encodeURIComponent(eventId)}`
    : `${origin}/invite/${code}`
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers without clipboard API permission.
    const el = document.createElement('input')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'absolute'
    el.style.left = '-9999px'
    document.body.appendChild(el)
    el.select()
    try {
      document.execCommand('copy')
      document.body.removeChild(el)
      return true
    } catch {
      document.body.removeChild(el)
      return false
    }
  }
}

export function ShareButton({
  code,
  eventId,
  shareTitle,
  shareText,
  variant = 'pill',
  className,
  label = 'Share',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const url = buildShareUrl(code, eventId)

    // Prefer native share sheet on mobile / supporting browsers.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url })
        return
      } catch (err) {
        // User cancelled — fall through to clipboard if it wasn't an abort.
        if ((err as DOMException)?.name === 'AbortError') return
      }
    }

    const ok = await copyToClipboard(url)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={copied ? 'Link copied!' : 'Share'}
        className={cn(
          'inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 transition-all cursor-pointer',
          copied
            ? 'bg-green-500/15 border border-green-500/30 text-green-400'
            : 'bg-[#1a1a1a] border border-[#27272a] text-[#a1a1aa] hover:bg-[#e11d48]/10 hover:border-[#e11d48]/25 hover:text-[#e11d48]',
          className
        )}
      >
        {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      </button>
    )
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold transition-all cursor-pointer shrink-0',
          copied
            ? 'bg-green-500/15 border border-green-500/30 text-green-400'
            : 'bg-[#1a1a1a] border border-[#27272a] text-[#a1a1aa] hover:bg-[#e11d48]/10 hover:border-[#e11d48]/25 hover:text-[#e11d48]',
          className
        )}
      >
        {copied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
        {copied ? 'Copied' : label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0',
        copied
          ? 'bg-green-500/15 border border-green-500/30 text-green-400'
          : 'bg-[#1a1a1a] border border-[#27272a] text-[#a1a1aa] hover:bg-[#e11d48]/10 hover:border-[#e11d48]/25 hover:text-[#e11d48]',
        className
      )}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Link copied' : label}
    </button>
  )
}
