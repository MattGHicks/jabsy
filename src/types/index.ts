import type { Database } from './database'

// Table row types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type Fight = Database['public']['Tables']['fights']['Row']
export type League = Database['public']['Tables']['leagues']['Row']
export type LeagueMember = Database['public']['Tables']['league_members']['Row']
export type LeagueEvent = Database['public']['Tables']['league_events']['Row']
export type Invite = Database['public']['Tables']['invites']['Row']
export type PickRow = Database['public']['Tables']['picks']['Row']

// Insert types
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type FightInsert = Database['public']['Tables']['fights']['Insert']
export type LeagueInsert = Database['public']['Tables']['leagues']['Insert']
export type PickInsert = Database['public']['Tables']['picks']['Insert']

// Composite types
export type LeagueWithOwner = League & {
  owner: { id: string; username: string | null; avatar_url: string | null }
  member_count: number
  user_role?: 'admin' | 'member' | 'owner'
}

export type EventWithFights = Event & {
  fights: Fight[]
}

export type FightWithPick = Fight & {
  userPick?: PickRow
}

export type LeaderboardEntry = {
  user_id: string
  username: string
  avatar_url: string | null
  total_points: number
  fights_picked: number
  correct_winners: number
  correct_methods: number
  correct_rounds: number
}
