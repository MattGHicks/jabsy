import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { createEvent } from '@/actions/admin'

interface PageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function NewEventPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { error } = await searchParams

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
      <Link href="/admin" className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70">
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#52525b] uppercase mb-1">Back to</span>
          <span className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}>Admin</span>
        </div>
      </Link>

      <div className="mb-8">
        <h1
          className="leading-none text-[#f4f4f5] mb-2"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '2.5rem' }}
        >
          CREATE EVENT
        </h1>
        <p className="text-sm text-[#71717a]">Add a new MMA event to the master schedule.</p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/30">
          <p className="text-xs text-[#e11d48]">{decodeURIComponent(error)}</p>
        </div>
      )}

      <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg p-6">
        <form action={createEvent} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-[#a1a1aa]">
              Event Name <span className="text-[#e11d48]">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="e.g. UFC 310: Jones vs Miocic"
              className="h-10 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="start_time" className="text-xs font-medium text-[#a1a1aa]">
              Date & Time <span className="text-[#e11d48]">*</span>
            </label>
            <input
              id="start_time"
              name="start_time"
              type="datetime-local"
              required
              className="h-10 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors [color-scheme:dark]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="venue" className="text-xs font-medium text-[#a1a1aa]">
              Venue <span className="text-[#52525b]">(optional)</span>
            </label>
            <input
              id="venue"
              name="venue"
              type="text"
              placeholder="e.g. T-Mobile Arena, Las Vegas"
              className="h-10 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="status" className="text-xs font-medium text-[#a1a1aa]">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue="upcoming"
              className="h-10 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors"
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <button
            type="submit"
            className="h-10 w-full rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors cursor-pointer mt-1"
          >
            Create Event
          </button>
        </form>
      </div>
    </div>
  )
}
