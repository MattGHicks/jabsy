'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, ExternalLink } from 'lucide-react'
import { auditSherdogLinks } from '@/actions/admin'
import type { SherdogAuditResult, SherdogLinkIssue } from '@/lib/api/sherdog-audit'

const PROBLEM_LABELS: Record<SherdogLinkIssue['problem'], string> = {
  mismatch: 'Wrong fighter',
  unresolved: 'Never resolved',
  missing: 'No link',
  review: 'Check by hand',
}

const PROBLEM_STYLES: Record<SherdogLinkIssue['problem'], string> = {
  mismatch: 'text-[#e11d48] border-[#e11d48]/30 bg-[#e11d48]/[0.08]',
  unresolved: 'text-amber-400 border-amber-400/30 bg-amber-400/[0.08]',
  missing: 'text-[#71717a] border-[#27272a] bg-[#111111]',
  review: 'text-blue-400 border-blue-400/30 bg-blue-400/[0.08]',
}

export function SherdogAudit() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<SherdogAuditResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setStatus('running')
    setError(null)
    setResult(null)
    try {
      setResult(await auditSherdogLinks())
      setStatus('done')
    } catch (err) {
      setError(String(err))
      setStatus('error')
    }
  }

  const counts = result?.issues.reduce<Record<string, number>>((acc, i) => {
    acc[i.problem] = (acc[i.problem] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleRun}
          disabled={status === 'running'}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#111111] border border-[#1e1e1e] text-[#71717a] text-xs font-semibold hover:text-[#a1a1aa] hover:border-[#27272a] transition-all disabled:opacity-50 cursor-pointer"
        >
          {status === 'running' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5" />
          )}
          {status === 'running' ? 'Checking links...' : 'Check Sherdog links'}
        </button>

        {status === 'done' && result && (
          <span className="text-xs text-[#71717a]">
            Checked {result.checked} links ·{' '}
            {result.issues.length === 0 ? (
              <span className="text-green-400">all good</span>
            ) : (
              Object.entries(counts ?? {})
                .map(([k, n]) => `${n} ${PROBLEM_LABELS[k as SherdogLinkIssue['problem']].toLowerCase()}`)
                .join(' · ')
            )}
          </span>
        )}
        {status === 'error' && <span className="text-xs text-[#e11d48]">{error}</span>}
      </div>

      {status === 'done' && result && result.issues.length > 0 && (
        <div className="rounded-lg border border-[#1e1e1e] divide-y divide-[#161616] max-h-96 overflow-y-auto">
          {result.issues.map((issue, i) => (
            <div key={`${issue.fightId}-${issue.corner}-${i}`} className="flex items-center gap-3 px-3 py-2 text-xs">
              <span
                className={`shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-wide ${PROBLEM_STYLES[issue.problem]}`}
              >
                {PROBLEM_LABELS[issue.problem]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[#f4f4f5] font-semibold truncate">{issue.fighterName}</p>
                <p className="text-[10px] text-[#52525b] truncate">
                  {issue.eventName}
                  {issue.eventStatus === 'upcoming' && <span className="text-amber-400"> · upcoming</span>}
                </p>
              </div>
              {issue.url && (
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-[10px] text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                >
                  {issue.url.match(/\/fighter\/(.+?)-\d+$/)?.[1]?.replace(/-/g, ' ') ?? 'link'}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
