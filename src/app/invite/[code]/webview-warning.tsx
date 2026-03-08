'use client'

import { useState } from 'react'
import { AlertTriangle, Copy, Check, X } from 'lucide-react'

interface WebViewWarningProps {
  inviteUrl: string
}

export function WebViewWarning({ inviteUrl }: WebViewWarningProps) {
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  if (dismissed) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback: select the text from a temp input
      const el = document.createElement('input')
      el.value = inviteUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  return (
    <div className="mb-6 relative rounded-lg border border-amber-500/30 bg-amber-500/8 px-4 py-3.5">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2.5 right-2.5 text-amber-500/50 hover:text-amber-500/80 transition-colors cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-300 mb-1">
            You&apos;re in an in-app browser
          </p>
          <p className="text-xs text-amber-400/70 leading-relaxed mb-3">
            Google sign-in is blocked here. Copy the invite link and open it in{' '}
            <span className="text-amber-300">Safari</span> or{' '}
            <span className="text-amber-300">Chrome</span> to create your account.
          </p>

          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-amber-400/60 truncate font-mono bg-black/20 rounded px-2 py-1">
              {inviteUrl}
            </code>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-amber-500/15 border border-amber-500/25 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/25 transition-colors cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy link
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
