import Link from 'next/link'
import { loginWithEmail } from '@/actions/auth'
import { PasswordInput } from './password-input'
import { WebViewBanner, GoogleSignInSection } from './webview-banner'

interface PageProps {
  searchParams: Promise<{ error?: string; pending_invite?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error, pending_invite } = await searchParams

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <Link href="/" className="text-2xl font-black text-[#e11d48] mb-10 tracking-wide" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
        JABSY
      </Link>

      <div className="w-full max-w-sm">
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg p-8">
          <div className="mb-7">
            <h1 className="text-xl font-semibold text-[#f4f4f5] mb-1">
              {pending_invite ? 'Sign in to accept your invite' : 'Welcome back'}
            </h1>
            <p className="text-sm text-[#71717a]">
              {pending_invite ? 'Sign in to join the league.' : 'Sign in to your account'}
            </p>
          </div>

          <WebViewBanner />

          {error && (
            <div className="mb-5 p-3 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/30">
              <p className="text-xs text-[#e11d48]">{decodeURIComponent(error)}</p>
            </div>
          )}

          <GoogleSignInSection
            href={pending_invite ? `/api/auth/google?pending_invite=${pending_invite}` : '/api/auth/google'}
          />

          <form action={loginWithEmail} className="flex flex-col gap-4">
            {pending_invite && <input type="hidden" name="pending_invite" value={pending_invite} />}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-medium text-[#a1a1aa]">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com"
                className="h-10 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors" />
            </div>

            <PasswordInput />

            <button type="submit" className="h-10 w-full rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors cursor-pointer mt-1">
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#71717a] mt-5">
          Don&apos;t have an account?{' '}
          <Link href={pending_invite ? `/signup?pending_invite=${pending_invite}` : '/signup'} className="text-[#f4f4f5] hover:text-[#e11d48] transition-colors font-medium">
            Sign up
          </Link>
        </p>

        <p className="text-center text-xs text-[#52525b] mt-4">
          <Link href="/privacy" className="hover:text-[#71717a] transition-colors">Privacy Policy</Link>
          {' · '}
          <Link href="/terms" className="hover:text-[#71717a] transition-colors">Terms of Service</Link>
        </p>
      </div>
    </div>
  )
}
