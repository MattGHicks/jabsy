import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft, ChevronRight, Crown, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn, getInitials, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ leagueId: string }>
}

export default async function MembersPage({ params }: PageProps) {
  const { leagueId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, owner_id, created_at')
    .eq('id', leagueId)
    .single()
  if (!league) notFound()

  const { data: membership } = await supabase
    .from('league_members')
    .select('role')
    .eq('league_id', leagueId)
    .eq('user_id', user.id)
    .single()

  const isOwner = league.owner_id === user.id
  if (!isOwner && !membership) redirect('/dashboard')

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id, joined_at, profiles(id, username, avatar_url)')
    .eq('league_id', leagueId)
    .order('joined_at', { ascending: true })

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('id', league.owner_id)
    .single()

  type Row = { id: string; username: string | null; avatar_url: string | null; joinedAt: string }
  const seen = new Set<string>()
  const rows: Row[] = []
  if (ownerProfile) {
    rows.push({
      id: ownerProfile.id,
      username: ownerProfile.username,
      avatar_url: ownerProfile.avatar_url,
      joinedAt: league.created_at,
    })
    seen.add(ownerProfile.id)
  }
  for (const m of members ?? []) {
    const p = m.profiles as { id: string; username: string | null; avatar_url: string | null } | null
    if (!p || seen.has(p.id)) continue
    rows.push({ id: p.id, username: p.username, avatar_url: p.avatar_url, joinedAt: m.joined_at })
    seen.add(p.id)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back */}
      <Link
        href={`/leagues/${leagueId}`}
        className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 mb-6 transition-all active:opacity-70"
      >
        <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
          <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
        </div>
        <div className="flex flex-col justify-center leading-none">
          <span className="text-[9px] font-semibold tracking-[0.15em] text-[#52525b] uppercase mb-1">Back to</span>
          <span
            className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}
          >
            {league.name}
          </span>
        </div>
      </Link>

      {/* Header */}
      <div className="mb-8">
        <p className="text-[10px] font-semibold text-[#3f3f46] uppercase tracking-[0.15em] mb-1.5 inline-flex items-center gap-1.5">
          <Users className="w-3 h-3" />
          {league.name} · {rows.length} {rows.length === 1 ? 'member' : 'members'}
        </p>
        <h1
          className="leading-[0.9] text-[#f4f4f5] uppercase"
          style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 2.75rem)' }}
        >
          Members
        </h1>
      </div>

      {/* Member rows */}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center rounded-xl border border-dashed border-[#1e1e1e]">
          <Users className="w-7 h-7 text-[#52525b] mb-2.5" />
          <p className="text-sm text-[#71717a]">No members yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((m) => {
            const isMe = m.id === user.id
            const isLeagueOwner = m.id === league.owner_id
            const profileUrl = isMe
              ? '/profile'
              : `/profile/${m.username ?? ''}?from=${leagueId}`
            return (
              <Link
                key={m.id}
                href={profileUrl}
                className={cn(
                  'flex items-center gap-4 px-4 sm:px-5 py-3.5 rounded-xl border transition-all duration-200 group',
                  isMe
                    ? 'bg-[#e11d48]/5 border-[#e11d48]/25 hover:bg-[#e11d48]/8'
                    : 'bg-[#111111] border-[#1e1e1e] hover:border-[#27272a] hover:bg-[#141414]'
                )}
              >
                <div className="w-11 h-11 rounded-full bg-[#1e1e1e] border border-[#27272a] overflow-hidden shrink-0 group-hover:border-[#3f3f46] transition-colors">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatar_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-[#71717a] flex items-center justify-center w-full h-full" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800 }}>
                      {getInitials(m.username ?? 'U')}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-base font-semibold truncate', isMe ? 'text-[#f4f4f5]' : 'text-[#f4f4f5]')}>
                      {m.username ?? 'Unknown'}
                    </p>
                    {isMe && <span className="text-[11px] text-[#e11d48] shrink-0">you</span>}
                    {isLeagueOwner && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#e11d48]/10 text-[#e11d48] border border-[#e11d48]/20 shrink-0">
                        <Crown className="w-2.5 h-2.5" />
                        Owner
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#52525b] mt-0.5">
                    Joined {formatDate(m.joinedAt)}
                  </p>
                </div>

                <span className="text-[10px] text-[#52525b] uppercase tracking-wider hidden sm:inline group-hover:text-[#a1a1aa] transition-colors">
                  View profile
                </span>
                <ChevronRight className="w-4 h-4 text-[#3f3f46] group-hover:text-[#a1a1aa] transition-colors shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
