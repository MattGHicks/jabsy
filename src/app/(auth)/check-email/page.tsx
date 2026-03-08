import Link from 'next/link'
import { Mail } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ email?: string; pending_invite?: string }>
}

export default async function CheckEmailPage({ searchParams }: PageProps) {
  const { email, pending_invite } = await searchParams

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <Link
        href="/"
        className="text-2xl font-black text-[#e11d48] mb-10 tracking-wide"
        style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
      >
        JABSY
      </Link>

      <div className="w-full max-w-sm">
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center mx-auto mb-5">
            <Mail className="w-6 h-6 text-[#e11d48]" />
          </div>

          <h1
            className="text-[#f4f4f5] uppercase mb-2"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '1.5rem' }}
          >
            Check Your Email
          </h1>

          <p className="text-sm text-[#71717a] mb-1">
            We sent a confirmation link to
          </p>
          {email && (
            <p className="text-sm font-semibold text-[#a1a1aa] mb-5 break-all">
              {email}
            </p>
          )}

          <p className="text-xs text-[#52525b] mb-6 leading-relaxed">
            Click the link in the email to confirm your account.
            {pending_invite && ' After confirming, you\'ll be taken straight to the league invite.'}
          </p>

          <div className="border-t border-[#1e1e1e] pt-5">
            <p className="text-xs text-[#52525b] mb-3">Already confirmed?</p>
            <Link
              href={pending_invite ? `/login?pending_invite=${pending_invite}` : '/login'}
              className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-[#1e1e1e] border border-[#27272a] text-sm font-medium text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
