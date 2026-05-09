'use client'

import { useState, useTransition } from 'react'
import { Info, ChevronDown, ExternalLink, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getMatchupPreview, type MatchupInfo } from '@/actions/fights'

interface Props {
  fightId: string
  redName: string
  redRecord: string | null
  redSherdogUrl: string | null
  blueName: string
  blueRecord: string | null
  blueSherdogUrl: string | null
  weightClass: string | null
  scheduledRounds: number
  initialPreview?: string | null
}

export function MatchupInfoButton({
  fightId,
  redName,
  redRecord,
  redSherdogUrl,
  blueName,
  blueRecord,
  blueSherdogUrl,
  weightClass,
  scheduledRounds,
  initialPreview,
}: Props) {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<MatchupInfo | null>(
    initialPreview != null
      ? {
          redName,
          redRecord,
          redSherdogUrl,
          blueName,
          blueRecord,
          blueSherdogUrl,
          weightClass,
          scheduledRounds,
          isMainEvent: false,
          preview: initialPreview,
        }
      : null
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle() {
    const next = !open
    setOpen(next)
    // Lazy-fetch the AI preview the first time the panel opens.
    if (next && !info && !isPending) {
      startTransition(async () => {
        const result = await getMatchupPreview(fightId)
        if (result.error) {
          setError(result.error)
          return
        }
        if (result.info) setInfo(result.info)
      })
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-end px-3 pb-2">
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          aria-controls={`matchup-info-${fightId}`}
          className={cn(
            'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-all cursor-pointer shrink-0',
            open
              ? 'bg-[#1a1a1a] border border-[#3f3f46] text-[#f4f4f5]'
              : 'bg-[#0a0a0a] border border-[#1e1e1e] text-[#52525b] hover:text-[#a1a1aa] hover:border-[#27272a]'
          )}
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
        >
          <Info className="w-3 h-3" />
          Matchup
          <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div
          id={`matchup-info-${fightId}`}
          className="mx-3 mb-3 rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] overflow-hidden animate-fade-in"
          style={{ animationDuration: '0.2s' }}
        >
          {/* Tale of the tape */}
          <div className="px-4 py-3 border-b border-[#1e1e1e]/60 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[9px] font-semibold text-[#52525b] uppercase tracking-wider mb-1">Red</p>
              <p className="text-sm font-bold text-[#e11d48] truncate" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                {redRecord ?? '—'}
              </p>
            </div>
            <div className="border-x border-[#1e1e1e]/60">
              <p className="text-[9px] font-semibold text-[#52525b] uppercase tracking-wider mb-1">
                {weightClass ?? 'Class'}
              </p>
              <p className="text-sm font-bold text-[#a1a1aa]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                {scheduledRounds} {scheduledRounds === 1 ? 'rd' : 'rds'}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold text-[#52525b] uppercase tracking-wider mb-1">Blue</p>
              <p className="text-sm font-bold text-blue-400 truncate" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                {blueRecord ?? '—'}
              </p>
            </div>
          </div>

          {/* AI preview */}
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-[#a78bfa]" />
              <p className="text-[9px] font-semibold text-[#a78bfa] uppercase tracking-wider">
                Matchup preview
              </p>
            </div>
            {isPending ? (
              <div className="flex items-center gap-2 text-xs text-[#71717a]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Generating preview…</span>
              </div>
            ) : error ? (
              <p className="text-[11px] text-[#71717a] leading-relaxed">
                Couldn&rsquo;t generate a preview right now. Tap the Sherdog links below for fighter histories.
              </p>
            ) : info?.preview ? (
              <p className="text-[12.5px] text-[#d4d4d8] leading-relaxed">{info.preview}</p>
            ) : (
              <p className="text-[11px] text-[#71717a] leading-relaxed">
                No preview available. Tap the Sherdog links below for fighter histories.
              </p>
            )}
          </div>

          {/* Sherdog links */}
          {(redSherdogUrl || blueSherdogUrl) && (
            <div className="px-4 py-2.5 border-t border-[#1e1e1e]/60 flex items-center justify-between gap-3">
              {redSherdogUrl ? (
                <a
                  href={redSherdogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#71717a] hover:text-[#e11d48] transition-colors uppercase tracking-wider"
                >
                  {redName}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : <span />}
              {blueSherdogUrl ? (
                <a
                  href={blueSherdogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#71717a] hover:text-blue-400 transition-colors uppercase tracking-wider"
                >
                  {blueName}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : <span />}
            </div>
          )}

          {/* AI disclaimer */}
          <p className="px-4 pb-3 text-[9px] text-[#3f3f46] leading-relaxed">
            AI-generated for context only — not a prediction.
          </p>
        </div>
      )}
    </div>
  )
}
