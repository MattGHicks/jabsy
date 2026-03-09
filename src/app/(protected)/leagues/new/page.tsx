import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createLeague } from '@/actions/leagues'

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function NewLeaguePage({ searchParams }: PageProps) {
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'league_owner') redirect('/dashboard')

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
      <Link href="/dashboard" className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70">
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#52525b] uppercase mb-1">Back to</span>
          <span className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}>Dashboard</span>
        </div>
      </Link>

      <div className="mb-8">
        <h1
          className="leading-none text-[#f4f4f5] mb-2"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '2.5rem' }}
        >
          CREATE A LEAGUE
        </h1>
        <p className="text-sm text-[#71717a]">
          Set up your league and invite friends to compete.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/30">
          <p className="text-xs text-[#e11d48]">{decodeURIComponent(error)}</p>
        </div>
      )}

      <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg p-6">
        <form action={createLeague} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-[#a1a1aa]">
              League Name <span className="text-[#e11d48]">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. Friday Night Knockouts"
              maxLength={60}
              className="h-10 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="description" className="text-xs font-medium text-[#a1a1aa]">
              Description <span className="text-[#52525b]">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              placeholder="A short description of your league..."
              rows={3}
              maxLength={200}
              className="w-full rounded-md px-3 py-2.5 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors resize-none"
            />
          </div>

          <button
            type="submit"
            className="h-10 w-full rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors cursor-pointer"
          >
            Create League
          </button>
        </form>
      </div>
    </div>
  )
}
