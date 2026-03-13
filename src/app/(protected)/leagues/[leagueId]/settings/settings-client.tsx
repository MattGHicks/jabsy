'use client'

import { useState } from 'react'
import { Copy, Check, Trash2 } from 'lucide-react'
import { deleteInvite } from '@/actions/invites'

interface SettingsClientProps {
  inviteCode: string
  inviteId: string
  leagueId: string
}

export function SettingsClient({ inviteCode, inviteId, leagueId }: SettingsClientProps) {
  const [copied, setCopied] = useState(false)

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/invite/${inviteCode}`
    : `/invite/${inviteCode}`

  async function handleCopy() {
    const url = `${window.location.origin}/invite/${inviteCode}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      const el = document.createElement('input')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleCopy}
        className="h-7 w-7 rounded-md flex items-center justify-center text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#1e1e1e] transition-colors"
        title="Copy invite link"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <form action={deleteInvite.bind(null, inviteId, leagueId)}>
        <button
          type="submit"
          className="h-7 w-7 rounded-md flex items-center justify-center text-[#71717a] hover:text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors"
          title="Delete invite"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  )
}
