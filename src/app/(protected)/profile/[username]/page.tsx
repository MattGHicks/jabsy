import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getInitials } from '@/lib/utils'
import { Trophy, Target, Zap, Users, Crown } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ username: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function PublicProfilePage({ params, searchParams }: PageProps) {
  const { username } = await params
  const { from: fromLeagueId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Find profile by username (case-insensitive)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, role, created_at')
    .ilike('username', username)
    .single()

  if (!profile) notFound()

  const isOwnProfile = profile.id === user.id

  // If viewing own profile redirect to the edit page
  if (isOwnProfile) redirect('/profile')

  // Get all their picks (scored only)
  const { data: allPicks } = await supabase
    .from('picks')
    .select('points_earned, league_id')
    .eq('user_id', profile.id)

  const scoredPicks = (allPicks ?? []).filter((p) => p.points_earned !== null)
  const totalPts = scoredPicks.reduce((sum, p) => sum + (p.points_earned ?? 0), 0)
  const correctPicks = scoredPicks.filter((p) => (p.points_earned ?? 0) >= 5)
  const accuracy = scoredPicks.length > 0 ? Math.round((correctPicks.length / scoredPicks.length) * 100) : null
  const totalPicksMade = (allPicks ?? []).length

  // Get leagues they're in (that the current user is also in)
  const { data: theirLeagues } = await supabase
    .from('league_members')
    .select('league_id, role, leagues(id, name, owner_id)')
    .eq('user_id', profile.id)

  // Also include leagues they own
  const { data: theirOwnedLeagues } = await supabase
    .from('leagues')
    .select('id, name, owner_id')
    .eq('owner_id', profile.id)

  // Build deduped list of league IDs they're in
  const memberLeagueIds = new Set((theirLeagues ?? []).map((l) => l.league_id))
  const ownedLeagues = (theirOwnedLeagues ?? []).filter((l) => !memberLeagueIds.has(l.id)).map((l) => ({
    id: l.id, name: l.name, isOwner: true
  }))
  const memberLeagues = (theirLeagues ?? []).map((l) => ({
    id: l.league_id,
    name: (l.leagues as { id: string; name: string; owner_id: string } | null)?.name ?? '',
    isOwner: l.role === 'admin' || (l.leagues as { id: string; name: string; owner_id: string } | null)?.owner_id === profile.id,
  }))
  const allLeagues = [...ownedLeagues, ...memberLeagues].filter((l) => l.name)

  // Fetch the league name for the back button if `from` is present
  let fromLeagueName: string | null = null
  if (fromLeagueId) {
    const { data: fromLeague } = await supabase
      .from('leagues')
      .select('name')
      .eq('id', fromLeagueId)
      .single()
    fromLeagueName = fromLeague?.name ?? null
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* Back button */}
      {fromLeagueId && (
        <div className="mb-6">
          <Link
            href={`/leagues/${fromLeagueId}`}
            className="group flex items-center gap-3 min-h-[44px] py-1 pr-4 -ml-0.5 w-fit transition-all active:opacity-70"
          >
            <div className="w-9 h-9 rounded-full bg-[#111111] border border-[#1e1e1e] flex items-center justify-center shrink-0 group-hover:bg-[#e11d48]/[0.08] group-hover:border-[#e11d48]/25 transition-all duration-200">
              <ChevronLeft className="w-4 h-4 text-[#52525b] group-hover:text-[#e11d48] transition-colors duration-200" />
            </div>
            <div className="flex flex-col justify-center leading-none">
              <span className="text-[9px] font-semibold tracking-[0.15em] text-[#3f3f46] uppercase mb-1">League</span>
              <span
                className="text-sm text-[#71717a] group-hover:text-[#f4f4f5] transition-colors duration-200 uppercase"
                style={{ fontFamily: 'var(--font-barlow)', fontWeight: 800, letterSpacing: '0.04em' }}
              >
                {fromLeagueName ?? 'Back'}
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* Profile header */}
      <div className="flex items-center gap-5 mb-10">
        <div className="w-20 h-20 rounded-full bg-[#1e1e1e] border-2 border-[#27272a] overflow-hidden shrink-0 flex items-center justify-center">
          {profile.avatar_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={profile.avatar_url} alt={profile.username ?? ''} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
            : <span className="text-2xl font-black text-[#52525b]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900 }}>
                {getInitials(profile.username ?? 'U')}
              </span>
          }
        </div>
        <div>
          <h1
            className="text-[#f4f4f5] uppercase leading-tight mb-1"
            style={{ fontFamily: 'var(--font-barlow)', fontWeight: 900, fontSize: 'clamp(1.8rem, 5vw, 2.8rem)' }}
          >
            {profile.username}
          </h1>
          <p className="text-xs text-[#52525b]">
            {profile.role === 'admin' ? 'Admin' : 'Jabsy Player'} · {allLeagues.length} {allLeagues.length === 1 ? 'league' : 'leagues'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-10">
        <div className="p-3 rounded-lg bg-[#141414] border border-[#1e1e1e] flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-7 h-7 rounded-md bg-[#e11d48]/10 border border-[#e11d48]/20 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-[#e11d48]" />
          </div>
          <div>
            <p className="text-xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{totalPts}</p>
            <p className="text-[10px] text-[#52525b] uppercase tracking-wider mt-1">Pts</p>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-[#141414] border border-[#1e1e1e] flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-7 h-7 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div>
            <p className="text-xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
              {accuracy !== null ? `${accuracy}%` : '—'}
            </p>
            <p className="text-[10px] text-[#52525b] uppercase tracking-wider mt-1">Accuracy</p>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-[#141414] border border-[#1e1e1e] flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-7 h-7 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Trophy className="w-3.5 h-3.5 text-[#a1a1aa]" />
          </div>
          <div>
            <p className="text-xl leading-none text-[#f4f4f5]" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>{totalPicksMade}</p>
            <p className="text-[10px] text-[#52525b] uppercase tracking-wider mt-1">Picks</p>
          </div>
        </div>
      </div>

      {/* Leagues */}
      {allLeagues.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#52525b] uppercase tracking-widest mb-3 flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Leagues
          </p>
          <div className="flex flex-col gap-2">
            {allLeagues.map((league) => (
              <div
                key={league.id}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#141414] border border-[#1e1e1e]"
              >
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${league.isOwner ? 'bg-[#e11d48]/10 border border-[#e11d48]/20' : 'bg-[#1e1e1e] border border-[#27272a]'}`}>
                  {league.isOwner
                    ? <Crown className="w-3.5 h-3.5 text-[#e11d48]" />
                    : <Users className="w-3.5 h-3.5 text-[#52525b]" />
                  }
                </div>
                <p className="text-sm font-semibold text-[#a1a1aa] uppercase flex-1 truncate" style={{ fontFamily: 'var(--font-barlow)', fontWeight: 700 }}>
                  {league.name}
                </p>
                {league.isOwner && (
                  <span className="text-xs text-[#e11d48] font-semibold shrink-0">Owner</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
