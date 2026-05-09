'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Mail, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { EmailOtpType } from '@supabase/supabase-js'

function ConfirmInner() {
  const searchParams = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') || '/onboarding'

  const [state, setState] = useState<'idle' | 'verifying' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const missingParams = !tokenHash || !type

  async function handleConfirm() {
    if (missingParams) return
    setState('verifying')
    setError(null)
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash!,
      type: type!,
    })
    if (verifyError) {
      setError(verifyError.message)
      setState('error')
      return
    }
    // Full reload so server components pick up the new auth cookies.
    window.location.href = next
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <h1
          className="text-center text-[#e11d48] uppercase mb-6"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, letterSpacing: '0.05em', fontSize: '2rem' }}
        >
          Jabsy
        </h1>

        <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#e11d48]/10 flex items-center justify-center mx-auto mb-5">
            {state === 'error' ? (
              <AlertCircle className="w-6 h-6 text-[#e11d48]" />
            ) : (
              <Mail className="w-6 h-6 text-[#e11d48]" />
            )}
          </div>

          {missingParams ? (
            <>
              <h2
                className="text-2xl text-[#f4f4f5] uppercase mb-2"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
              >
                Invalid link
              </h2>
              <p className="text-sm text-[#71717a]">
                This confirmation link is missing the token. Try signing up again to receive a new email.
              </p>
            </>
          ) : state === 'idle' ? (
            <>
              <h2
                className="text-2xl text-[#f4f4f5] uppercase mb-2"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
              >
                Confirm your email
              </h2>
              <p className="text-sm text-[#71717a] mb-6">
                Click the button below to verify your email and finish signing up.
              </p>
              <button
                onClick={handleConfirm}
                className="w-full h-11 rounded-lg bg-[#e11d48] text-white font-semibold hover:bg-[#be123c] transition-colors cursor-pointer"
              >
                Confirm my email
              </button>
            </>
          ) : state === 'verifying' ? (
            <>
              <h2
                className="text-2xl text-[#f4f4f5] uppercase mb-3"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
              >
                Verifying
              </h2>
              <div className="flex items-center justify-center gap-2 text-[#71717a]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Hang tight…</span>
              </div>
            </>
          ) : (
            <>
              <h2
                className="text-2xl text-[#f4f4f5] uppercase mb-2"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
              >
                Couldn&rsquo;t verify
              </h2>
              <p className="text-sm text-[#e11d48] mb-3">{error}</p>
              <p className="text-xs text-[#71717a]">
                The link may have expired. Sign up again to receive a fresh confirmation email.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  )
}
