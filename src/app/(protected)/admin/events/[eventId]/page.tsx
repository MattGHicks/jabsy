import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { EventManager } from './event-manager'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ error?: string }>
}

export default async function ManageFightsPage({ params, searchParams }: PageProps) {
  const { eventId } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single()
  if (!event) notFound()

  const { data: fights } = await supabase
    .from('fights')
    .select('*')
    .eq('event_id', eventId)
    .order('bout_order', { ascending: true })

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/admin" className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70">
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#3f3f46] uppercase mb-1">Back to</span>
          <span className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}>Admin</span>
        </div>
      </Link>

      <div className="mb-8">
        <p className="text-xs text-[#71717a] mb-1">{formatDateTime(event.start_time)}</p>
        <h1
          className="leading-none text-[#f4f4f5] mb-1 uppercase"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}
        >
          {event.name}
        </h1>
        {event.venue && <p className="text-sm text-[#71717a]">{event.venue}</p>}
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/30">
          <p className="text-xs text-[#e11d48]">{decodeURIComponent(error)}</p>
        </div>
      )}

      <EventManager initialFights={fights ?? []} eventId={eventId} />
    </div>
  )
}
