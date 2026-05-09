import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from './onboarding-form'

interface PageProps {
  searchParams: Promise<{ error?: string; pending_invite?: string; event?: string }>
}

export default async function OnboardingPage({ searchParams }: PageProps) {
  const { error, pending_invite, event } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch existing profile to get Google avatar (set by trigger on signup)
  const { data: profile } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  // Google stores avatar_url in user_metadata as well — use whichever is available
  const googleAvatarUrl =
    profile?.avatar_url ??
    (user.user_metadata?.avatar_url as string | undefined) ??
    null

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
        <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg p-8">
          <div className="mb-7">
            <h1
              className="text-2xl font-black text-[#f4f4f5] mb-1 leading-tight"
              style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}
            >
              CHOOSE YOUR FIGHTER NAME
            </h1>
            <p className="text-sm text-[#71717a]">Set up your profile to enter the octagon</p>
          </div>

          {error && (
            <div className="mb-5 px-3 py-2 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/20 text-sm text-[#e11d48]">
              {decodeURIComponent(error)}
            </div>
          )}

          <OnboardingForm
            googleAvatarUrl={googleAvatarUrl}
            pendingInvite={pending_invite}
            pendingEvent={event}
          />
        </div>
      </div>
    </div>
  )
}
