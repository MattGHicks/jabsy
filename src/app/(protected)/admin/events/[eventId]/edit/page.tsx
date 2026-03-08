import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { updateEvent } from '@/actions/admin'

interface PageProps {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ error?: string }>
}

/** Convert a DB UTC timestamp to YYYY-MM-DDTHH:MM in Eastern Time for datetime-local input */
function toDatetimeLocal(isoString: string | null): string {
  if (!isoString) return ''
  const d = new Date(isoString)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value
    return acc
  }, {})
  // Handle midnight edge case where hour is "24"
  const hour = parts.hour === '24' ? '00' : parts.hour
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`
}

export default async function EditEventPage({ params, searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { eventId } = await params
  const { error } = await searchParams

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event) redirect('/admin')

  const inputClass = 'h-10 w-full rounded-md px-3 text-sm bg-[#0a0a0a] border border-[#27272a] text-[#f4f4f5] placeholder:text-[#3f3f46] focus:outline-none focus:border-[#e11d48]/50 focus:ring-1 focus:ring-[#e11d48]/20 transition-colors'

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
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
        <h1
          className="leading-none text-[#f4f4f5] mb-2"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: '2.5rem' }}
        >
          EDIT EVENT
        </h1>
        <p
          className="text-base text-[#71717a] uppercase truncate"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}
        >
          {event.name}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/30">
          <p className="text-xs text-[#e11d48]">{decodeURIComponent(error)}</p>
        </div>
      )}

      <div className="bg-[#141414] border border-[#1e1e1e] rounded-lg p-6">
        <form action={updateEvent} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={event.id} />

          {/* Event Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-xs font-medium text-[#a1a1aa]">
              Event Name <span className="text-[#e11d48]">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={event.name}
              placeholder="e.g. UFC 310: Jones vs Miocic"
              className={inputClass}
            />
          </div>

          {/* Start Time */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="start_time" className="text-xs font-medium text-[#a1a1aa]">
              Event Start Time <span className="text-[#e11d48]">*</span>
            </label>
            <input
              id="start_time"
              name="start_time"
              type="datetime-local"
              required
              defaultValue={toDatetimeLocal(event.start_time)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>

          {/* Venue */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="venue" className="text-xs font-medium text-[#a1a1aa]">
              Venue <span className="text-[#52525b]">(optional)</span>
            </label>
            <input
              id="venue"
              name="venue"
              type="text"
              defaultValue={event.venue ?? ''}
              placeholder="e.g. T-Mobile Arena, Las Vegas"
              className={inputClass}
            />
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="status" className="text-xs font-medium text-[#a1a1aa]">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={event.status}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex gap-3 mt-1">
            <Link
              href="/admin"
              className="flex-1 h-10 rounded-md text-sm font-semibold border border-[#27272a] bg-[#1e1e1e] text-[#a1a1aa] hover:text-[#f4f4f5] hover:border-[#333] transition-colors inline-flex items-center justify-center"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="flex-1 h-10 rounded-md bg-[#e11d48] text-white text-sm font-semibold hover:bg-[#be123c] transition-colors cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
