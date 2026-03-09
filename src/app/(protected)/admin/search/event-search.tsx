'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, CheckCircle2, ChevronDown, ChevronUp, Star, AlertCircle } from 'lucide-react'
import { searchForEvents, importEvent } from '@/actions/sync'
import { cn } from '@/lib/utils'
import type { MappedEvent, MappedFight } from '@/lib/api/types'

export function EventSearch() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<MappedEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<string>('')
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadEvents()
  }, [])

  async function loadEvents() {
    setLoading(true)
    setError(null)
    try {
      const result = await searchForEvents()
      setEvents(result.events)
      setSource(result.source)
      if (result.error) setError(result.error)

      const imported = new Set(
        result.events.filter(e => e.alreadyImported).map(e => e.espnEventId)
      )
      setImportedIds(imported)
    } catch (err) {
      setError(`Failed to search: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleImport(espnEventId: string) {
    setImporting(espnEventId)
    try {
      const result = await importEvent(espnEventId)
      if (result.success && result.eventId) {
        setImportedIds(prev => new Set([...prev, espnEventId]))
        router.push(`/admin/events/${result.eventId}`)
      } else {
        setError(result.error ?? 'Import failed')
      }
    } catch (err) {
      setError(`Import error: ${err}`)
    } finally {
      setImporting(null)
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/New_York',
    })
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    })
  }

  function daysUntil(iso: string) {
    const now = new Date()
    const event = new Date(iso)
    const diff = Math.ceil((event.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Tomorrow'
    if (diff < 0) return `${Math.abs(diff)}d ago`
    return `In ${diff} days`
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center py-20">
        <Loader2 className="w-8 h-8 text-[#e11d48] animate-spin mb-4" />
        <p className="text-sm text-[#71717a]">Searching for upcoming UFC events...</p>
        <p className="text-xs text-[#52525b] mt-1">Checking ESPN & AI sources</p>
      </div>
    )
  }

  if (error && events.length === 0) {
    return (
      <div className="flex flex-col items-center py-20">
        <AlertCircle className="w-8 h-8 text-[#e11d48] mb-4" />
        <p className="text-sm text-[#a1a1aa] mb-4">{error}</p>
        <button
          onClick={loadEvents}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e1e1e] border border-[#27272a] text-sm text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors cursor-pointer"
        >
          <Search className="w-4 h-4" />
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Source indicator */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-[10px] font-bold text-[#52525b] uppercase tracking-widest">
          {events.length} events found
          <span className="ml-1.5 font-normal normal-case text-[#3f3f46]">
            via {source === 'espn' ? 'ESPN' : source === 'claude' ? 'Claude AI' : 'multiple sources'}
          </span>
        </p>
        <button
          onClick={loadEvents}
          className="inline-flex items-center gap-1.5 text-xs text-[#52525b] hover:text-[#a1a1aa] transition-colors cursor-pointer"
        >
          <Search className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-[#e11d48]/5 border border-[#e11d48]/20 text-sm text-[#e11d48]">
          {error}
        </div>
      )}

      {/* Event cards */}
      <div className="flex flex-col gap-3">
        {events.map((event) => {
          const isExpanded = expandedEvent === event.espnEventId
          const isImported = importedIds.has(event.espnEventId)
          const isImporting = importing === event.espnEventId

          return (
            <div
              key={event.espnEventId}
              className={cn(
                'rounded-xl border transition-colors',
                isImported
                  ? 'bg-[#111111] border-emerald-500/20'
                  : 'bg-[#111111] border-[#1e1e1e] hover:border-[#27272a]'
              )}
            >
              {/* Event card */}
              <div className="p-5 sm:p-6">
                {/* Top: badges + actions */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#e11d48] uppercase tracking-wider">
                      {daysUntil(event.startTime)}
                    </span>
                    {isImported && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        Imported
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {event.fights.length > 0 && (
                      <button
                        onClick={() => setExpandedEvent(isExpanded ? null : event.espnEventId)}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-[#1e1e1e] text-[#71717a] hover:text-[#a1a1aa] hover:border-[#27272a] transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {isExpanded ? 'Hide' : 'Preview'}
                      </button>
                    )}
                    {!isImported && (
                      <button
                        onClick={() => handleImport(event.espnEventId)}
                        disabled={isImporting}
                        className="inline-flex items-center gap-2 h-8 px-4 rounded-lg bg-[#e11d48] text-white text-xs font-semibold hover:bg-[#be123c] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          'Import'
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Event name */}
                <h3
                  className="text-[#f4f4f5] uppercase leading-[0.95] mb-3"
                  style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: 'clamp(1.15rem, 3vw, 1.4rem)' }}
                >
                  {event.name}
                </h3>

                {/* Meta line */}
                <p className="text-xs text-[#52525b]">
                  {formatDate(event.startTime)} · {formatTime(event.startTime)}
                  {event.venue && (
                    <><span className="mx-1.5 text-[#333]">·</span>{event.venue}</>
                  )}
                  <span className="mx-1.5 text-[#333]">·</span>
                  {event.fightCount} fights
                </p>
              </div>

              {/* Expanded fight card preview */}
              {isExpanded && event.fights.length > 0 && (
                <div className="border-t border-[#1a1a1a] px-5 sm:px-6 py-4">
                  <p className="text-[10px] font-bold text-[#3f3f46] uppercase tracking-widest mb-3">
                    Fight Card
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {event.fights.map((fight, i) => (
                      <FightRow key={fight.espnCompetitionId} fight={fight} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FightRow({ fight, index }: { fight: MappedFight; index: number }) {
  return (
    <div className={cn(
      'flex items-center gap-3 py-2.5 px-3 rounded-lg',
      fight.isMainEvent ? 'bg-[#e11d48]/5' : 'bg-[#0a0a0a]'
    )}>
      {/* Bout order */}
      <span className="text-[11px] text-[#3f3f46] w-5 text-center shrink-0 font-bold">
        {fight.isMainEvent ? <Star className="w-3 h-3 text-[#e11d48]" /> : index + 1}
      </span>

      {/* Fighters */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-[13px] text-[#e11d48] uppercase truncate"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
          >
            {fight.redName}
          </span>
          {fight.redRecord && (
            <span className="text-[10px] text-[#3f3f46] shrink-0">({fight.redRecord})</span>
          )}
          <span className="text-[10px] text-[#3f3f46] font-bold">vs</span>
          <span
            className="text-[13px] text-blue-400 uppercase truncate"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
          >
            {fight.blueName}
          </span>
          {fight.blueRecord && (
            <span className="text-[10px] text-[#3f3f46] shrink-0">({fight.blueRecord})</span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0">
        {fight.weightClass && (
          <span className="text-[10px] text-[#3f3f46]">
            {fight.weightClass}
          </span>
        )}
        <span className="text-[10px] text-[#3f3f46]">
          {fight.scheduledRounds}R
        </span>
      </div>
    </div>
  )
}
