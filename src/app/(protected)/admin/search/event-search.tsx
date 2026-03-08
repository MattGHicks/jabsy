'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, CheckCircle2, ChevronDown, ChevronUp, MapPin, Calendar, Swords, Star, AlertCircle } from 'lucide-react'
import { searchForEvents, importEvent } from '@/actions/sync'
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

      // Track already-imported events
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#1e1e1e] border border-[#27272a] text-sm text-[#a1a1aa] hover:text-[#f4f4f5] transition-colors cursor-pointer"
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
        <p className="text-xs text-[#52525b]">
          Found {events.length} upcoming events via {source === 'espn' ? 'ESPN' : source === 'claude' ? 'Claude AI' : 'multiple sources'}
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
        <div className="mb-4 p-3 rounded-lg bg-[#e11d48]/5 border border-[#e11d48]/20 text-sm text-[#e11d48]">
          {error}
        </div>
      )}

      {/* Event cards */}
      <div className="flex flex-col gap-4">
        {events.map((event) => {
          const isExpanded = expandedEvent === event.espnEventId
          const isImported = importedIds.has(event.espnEventId)
          const isImporting = importing === event.espnEventId

          return (
            <div
              key={event.espnEventId}
              className={`rounded-xl border transition-colors ${
                isImported
                  ? 'bg-[#111111] border-emerald-500/20'
                  : 'bg-[#141414] border-[#1e1e1e] hover:border-[#27272a]'
              }`}
            >
              {/* Event header */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-[#e11d48] bg-[#e11d48]/10 px-2 py-0.5 rounded">
                        {daysUntil(event.startTime)}
                      </span>
                      {isImported && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" />
                          Imported
                        </span>
                      )}
                    </div>
                    <h3
                      className="text-lg text-[#f4f4f5] uppercase leading-tight"
                      style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}
                    >
                      {event.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-[#71717a]">
                        <Calendar className="w-3 h-3" />
                        {formatDate(event.startTime)} · {formatTime(event.startTime)}
                      </span>
                      {event.venue && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#71717a]">
                          <MapPin className="w-3 h-3" />
                          {event.venue}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs text-[#71717a]">
                        <Swords className="w-3 h-3" />
                        {event.fightCount} fights
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {event.fights.length > 0 && (
                      <button
                        onClick={() => setExpandedEvent(isExpanded ? null : event.espnEventId)}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs font-semibold border border-[#27272a] bg-[#1e1e1e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333] transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {isExpanded ? 'Hide' : 'Preview'}
                      </button>
                    )}
                    {!isImported && (
                      <button
                        onClick={() => handleImport(event.espnEventId)}
                        disabled={isImporting}
                        className="inline-flex items-center gap-2 h-9 px-4 rounded-md bg-[#e11d48] text-white text-xs font-semibold hover:bg-[#be123c] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isImporting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>Add Event</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded fight card preview */}
              {isExpanded && event.fights.length > 0 && (
                <div className="border-t border-[#1e1e1e] px-5 py-4">
                  <div className="flex flex-col gap-2">
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
    <div className={`flex items-center gap-3 py-2 px-3 rounded-lg ${fight.isMainEvent ? 'bg-[#e11d48]/5 border border-[#e11d48]/10' : 'bg-[#111111]'}`}>
      {/* Bout order */}
      <span className="text-xs text-[#52525b] w-5 text-center shrink-0">
        {fight.isMainEvent ? <Star className="w-3.5 h-3.5 text-[#e11d48]" /> : index + 1}
      </span>

      {/* Fighters */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-[#f4f4f5] font-medium truncate">{fight.redName}</span>
          {fight.redRecord && (
            <span className="text-[10px] text-[#52525b] shrink-0">({fight.redRecord})</span>
          )}
          <span className="text-xs text-[#52525b] mx-1">vs</span>
          <span className="text-sm text-[#f4f4f5] font-medium truncate">{fight.blueName}</span>
          {fight.blueRecord && (
            <span className="text-[10px] text-[#52525b] shrink-0">({fight.blueRecord})</span>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 shrink-0">
        {fight.weightClass && (
          <span className="text-[10px] text-[#52525b] bg-[#1e1e1e] px-1.5 py-0.5 rounded">
            {fight.weightClass}
          </span>
        )}
        <span className="text-[10px] text-[#52525b]">
          {fight.scheduledRounds}R
        </span>
      </div>
    </div>
  )
}
