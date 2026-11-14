import Link from 'next/link'
import { signUp } from '@/actions/auth'
import { WebViewBanner, GoogleSignInSection } from '../login/webview-banner'

interface PageProps {
  searchParams: Promise<{ error?: string; pending_invite?: string; event?: string }>
}

export default async function SignupPage({ searchParams }: PageProps) {
  const { error, pending_invite, event } = await searchParams
  const inviteQs = pending_invite ? `pending_invite=${pending_invite}${event ? `&event=${event}` : ''}` : ''

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4">
      <Link href="/" className="text-3xl text-brand mb-8 tracking-[0.08em]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
        JABSY
      </Link>

      <div className="w-full max-w-sm">
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl p-6 sm:p-8">
          <div className="mb-7">
            <h1 className="text-xl font-semibold text-text-primary mb-1">
              {pending_invite ? 'Create an account to join' : 'Create your account'}
            </h1>
            <p className="text-sm text-text-secondary">
              {pending_invite ? 'Sign up to accept your league invite.' : 'Start competing with your crew'}
            </p>
          </div>

          <WebViewBanner />

          {error && (
            <div className="mb-5 p-3 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/30">
              <p className="text-xs text-[#e11d48]">{decodeURIComponent(error)}</p>
            </div>
          )}

          <GoogleSignInSection
            href={pending_invite ? `/api/auth/google?${inviteQs}` : '/api/auth/google'}
          />

          <form action={signUp} className="flex flex-col gap-4">
            {pending_invite && <input type="hidden" name="pending_invite" value={pending_invite} />}
            {event && <input type="hidden" name="event" value={event} />}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-text-secondary">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@example.com"
                className="h-11 w-full rounded-lg px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-text-secondary">Password</label>
              <input id="password" name="password" type="password" required autoComplete="new-password" placeholder="Min. 8 characters"
                className="h-11 w-full rounded-lg px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm_password" className="text-sm font-medium text-text-secondary">Confirm Password</label>
              <input id="confirm_password" name="confirm_password" type="password" required autoComplete="new-password" placeholder="••••••••"
                className="h-11 w-full rounded-lg px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-text-primary placeholder:text-text-faint focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors" />
            </div>

            <button type="submit" className="h-11 w-full rounded-lg bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors cursor-pointer mt-1">
              Create account
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-text-secondary mt-5">
          Already have an account?{' '}
          <Link href={pending_invite ? `/login?${inviteQs}` : '/login'} className="text-text-primary hover:text-[#e11d48] transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
