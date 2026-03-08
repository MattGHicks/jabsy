import { redirect } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EventSearch } from './event-search'

export default async function SearchEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#a1a1aa] mb-4 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Admin
        </Link>
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/20 mb-3 ml-0 block">
          <ShieldCheck className="w-3 h-3 text-[#e11d48]" />
          <span className="text-xs font-semibold text-[#e11d48] uppercase tracking-widest">Admin</span>
        </div>
        <h1
          className="leading-none text-[#f4f4f5]"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2rem, 4vw, 3rem)' }}
        >
          SEARCH FOR EVENTS
        </h1>
        <p className="text-sm text-[#71717a] mt-2">
          Find upcoming UFC events and import them with full fight cards.
        </p>
      </div>

      <EventSearch />
    </div>
  )
}
