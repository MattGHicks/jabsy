'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, Loader2, Check, Pause, Play } from 'lucide-react'
import { syncFightCard, toggleAutoSync } from '@/actions/sync'

interface SyncControlsProps {
  eventId: string
  autoSyncEnabled: boolean
  lastSyncedAt: string | null
}

export function SyncControls({ eventId, autoSyncEnabled, lastSyncedAt }: SyncControlsProps) {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [autoSync, setAutoSync] = useState(autoSyncEnabled)
  const [, startTransition] = useTransition()

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await syncFightCard(eventId)
      if (result.success) {
        const { added, updated, cancelled } = result.changes
        const parts = []
        if (added > 0) parts.push(`${added} added`)
        if (updated > 0) parts.push(`${updated} updated`)
        if (cancelled > 0) parts.push(`${cancelled} cancelled`)
        setSyncResult(parts.length > 0 ? parts.join(', ') : 'No changes')
      } else {
        setSyncResult(result.error ?? 'Sync failed')
      }
    } catch (err) {
      setSyncResult('Sync error')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncResult(null), 4000)
    }
  }

  function handleToggleAutoSync() {
    const newValue = !autoSync
    setAutoSync(newValue)
    startTransition(async () => {
      await toggleAutoSync(eventId, newValue)
    })
  }

  function formatSyncTime(iso: string | null) {
    if (!iso) return 'Never'
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {/* Last synced */}
      <span className="text-[10px] text-[#52525b]">
        Last synced: {formatSyncTime(lastSyncedAt)}
      </span>

      {/* Re-sync button */}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[10px] font-semibold border border-[#27272a] bg-[#1e1e1e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333] disabled:opacity-50 transition-colors cursor-pointer"
      >
        {syncing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        {syncing ? 'Syncing...' : 'Re-sync Card'}
      </button>

      {/* Auto-sync toggle */}
      <button
        onClick={handleToggleAutoSync}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[10px] font-semibold border border-[#27272a] bg-[#1e1e1e] text-[#71717a] hover:text-[#a1a1aa] hover:border-[#333] transition-colors cursor-pointer"
      >
        {autoSync ? (
          <>
            <Pause className="w-3 h-3" />
            Pause Auto-Sync
          </>
        ) : (
          <>
            <Play className="w-3 h-3" />
            Enable Auto-Sync
          </>
        )}
      </button>

      {/* Sync result */}
      {syncResult && (
        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
          <Check className="w-3 h-3" />
          {syncResult}
        </span>
      )}
    </div>
  )
}
