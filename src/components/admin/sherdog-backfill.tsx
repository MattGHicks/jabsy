'use client'

import { useState } from 'react'
import { Loader2, Link2 } from 'lucide-react'
import { backfillSherdogUrls } from '@/actions/admin'

export function SherdogBackfill() {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ updated: number; remaining: number; error?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setStatus('running')
    setError(null)
    setResult(null)
    try {
      const res = await backfillSherdogUrls()
      if (res.success) {
        setResult({ updated: res.updated, remaining: res.remaining, error: res.error })
        setStatus('done')
      } else {
        setError(res.error ?? 'Unknown error')
        setStatus('error')
      }
    } catch (err) {
      setError(String(err))
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          onClick={handleRun}
          disabled={status === 'running'}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#111111] border border-[#1e1e1e] text-[#71717a] text-xs font-semibold hover:text-[#a1a1aa] hover:border-[#27272a] transition-all disabled:opacity-50 cursor-pointer"
        >
          {status === 'running' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Link2 className="w-3.5 h-3.5" />
          )}
          {status === 'running' ? 'Looking up (this takes a minute)...' : 'Fix Sherdog URLs'}
        </button>
        {status === 'done' && result && (
          <span className={`text-xs ${result.updated > 0 ? 'text-green-400' : 'text-amber-400'}`}>
            Updated {result.updated} fights{result.remaining > 0 ? ` · ${result.remaining} remaining` : ' · All done!'}
          </span>
        )}
        {status === 'error' && (
          <span className="text-xs text-[#e11d48]">{error}</span>
        )}
      </div>
      {status === 'done' && result?.error && (
        <p className="text-[10px] text-[#52525b] max-w-lg">{result.error}</p>
      )}
    </div>
  )
}
