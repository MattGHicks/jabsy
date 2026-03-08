'use client'

import { deleteLeague } from '@/actions/leagues'

export function DeleteLeagueButton({ leagueId }: { leagueId: string }) {
  return (
    <form
      action={deleteLeague.bind(null, leagueId)}
      onSubmit={(e) => {
        if (!confirm('Are you sure you want to delete this league? This cannot be undone.')) {
          e.preventDefault()
        }
      }}
    >
      <button
        type="submit"
        className="h-9 px-4 rounded-lg border border-[#e11d48]/40 text-sm font-semibold text-[#e11d48] hover:bg-[#e11d48] hover:text-white transition-colors"
      >
        Delete League
      </button>
    </form>
  )
}
