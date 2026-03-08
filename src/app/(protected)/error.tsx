'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-12 h-12 rounded-xl bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-[#e11d48]" />
      </div>
      <h2
        className="text-[#f4f4f5] mb-2"
        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: '1.5rem' }}
      >
        SOMETHING WENT WRONG
      </h2>
      <p className="text-sm text-[#71717a] mb-6 max-w-sm">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 h-10 px-5 rounded-lg text-sm font-semibold bg-[#e11d48] hover:bg-[#be123c] text-white transition-colors cursor-pointer"
      >
        Try Again
      </button>
    </div>
  )
}
