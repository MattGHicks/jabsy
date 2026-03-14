export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          role: 'admin' | 'league_owner' | 'player'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'league_owner' | 'player'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'league_owner' | 'player'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          name: string
          start_time: string
          lock_time: string | null
          venue: string | null
          status: 'upcoming' | 'live' | 'completed' | 'cancelled'
          created_by: string | null
          espn_event_id: string | null
          ufc_event_fmid: string | null
          auto_sync_enabled: boolean
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          start_time: string
          lock_time?: string | null
          venue?: string | null
          status?: 'upcoming' | 'live' | 'completed' | 'cancelled'
          created_by?: string | null
          espn_event_id?: string | null
          ufc_event_fmid?: string | null
          auto_sync_enabled?: boolean
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          start_time?: string
          lock_time?: string | null
          venue?: string | null
          status?: 'upcoming' | 'live' | 'completed' | 'cancelled'
          created_by?: string | null
          espn_event_id?: string | null
          ufc_event_fmid?: string | null
          auto_sync_enabled?: boolean
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fights: {
        Row: {
          id: string
          event_id: string
          bout_order: number
          scheduled_rounds: number
          weight_class: string | null
          is_main_event: boolean
          red_name: string
          red_record: string | null
          red_avatar_url: string | null
          red_sherdog_url: string | null
          blue_name: string
          blue_record: string | null
          blue_avatar_url: string | null
          blue_sherdog_url: string | null
          status: 'scheduled' | 'live' | 'final' | 'cancelled' | 'no_contest'
          result_winner: 'red' | 'blue' | 'draw' | 'nc' | null
          result_method: 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc' | 'draw' | null
          result_round: number | null
          espn_competition_id: string | null
          ufc_fight_id: string | null
          sync_status: 'synced' | 'modified' | 'manual'
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          bout_order?: number
          scheduled_rounds?: number
          weight_class?: string | null
          is_main_event?: boolean
          red_name: string
          red_record?: string | null
          red_avatar_url?: string | null
          red_sherdog_url?: string | null
          blue_name: string
          blue_record?: string | null
          blue_avatar_url?: string | null
          blue_sherdog_url?: string | null
          status?: 'scheduled' | 'live' | 'final' | 'cancelled' | 'no_contest'
          result_winner?: 'red' | 'blue' | 'draw' | 'nc' | null
          result_method?: 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc' | 'draw' | null
          result_round?: number | null
          espn_competition_id?: string | null
          ufc_fight_id?: string | null
          sync_status?: 'synced' | 'modified' | 'manual'
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          bout_order?: number
          scheduled_rounds?: number
          weight_class?: string | null
          is_main_event?: boolean
          red_name?: string
          red_record?: string | null
          red_avatar_url?: string | null
          red_sherdog_url?: string | null
          blue_name?: string
          blue_record?: string | null
          blue_avatar_url?: string | null
          blue_sherdog_url?: string | null
          status?: 'scheduled' | 'live' | 'final' | 'cancelled' | 'no_contest'
          result_winner?: 'red' | 'blue' | 'draw' | 'nc' | null
          result_method?: 'decision' | 'ko_tko' | 'submission' | 'dq' | 'nc' | 'draw' | null
          result_round?: number | null
          espn_competition_id?: string | null
          ufc_fight_id?: string | null
          sync_status?: 'synced' | 'modified' | 'manual'
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'fights_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
        ]
      }
      leagues: {
        Row: {
          id: string
          name: string
          owner_id: string
          description: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          description?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          description?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      league_members: {
        Row: {
          id: string
          league_id: string
          user_id: string
          role: 'admin' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          league_id: string
          user_id: string
          role?: 'admin' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          user_id?: string
          role?: 'admin' | 'member'
          joined_at?: string
        }
        Relationships: [
          { foreignKeyName: 'league_members_league_id_fkey'; columns: ['league_id']; isOneToOne: false; referencedRelation: 'leagues'; referencedColumns: ['id'] },
          { foreignKeyName: 'league_members_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      league_events: {
        Row: {
          id: string
          league_id: string
          event_id: string
          added_by: string | null
          added_at: string
        }
        Insert: {
          id?: string
          league_id: string
          event_id: string
          added_by?: string | null
          added_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          event_id?: string
          added_by?: string | null
          added_at?: string
        }
        Relationships: [
          { foreignKeyName: 'league_events_league_id_fkey'; columns: ['league_id']; isOneToOne: false; referencedRelation: 'leagues'; referencedColumns: ['id'] },
          { foreignKeyName: 'league_events_event_id_fkey'; columns: ['event_id']; isOneToOne: false; referencedRelation: 'events'; referencedColumns: ['id'] },
        ]
      }
      invites: {
        Row: {
          id: string
          code: string
          league_id: string
          created_by: string
          max_uses: number
          use_count: number
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          league_id: string
          created_by: string
          max_uses?: number
          use_count?: number
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          league_id?: string
          created_by?: string
          max_uses?: number
          use_count?: number
          expires_at?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'invites_league_id_fkey'; columns: ['league_id']; isOneToOne: false; referencedRelation: 'leagues'; referencedColumns: ['id'] },
        ]
      }
      picks: {
        Row: {
          id: string
          user_id: string
          fight_id: string
          league_id: string
          event_id: string
          pick_winner: 'red' | 'blue'
          pick_method: 'decision' | 'ko_tko' | 'submission'
          pick_round: number | null
          points_earned: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          fight_id: string
          league_id: string
          event_id: string
          pick_winner: 'red' | 'blue'
          pick_method: 'decision' | 'ko_tko' | 'submission'
          pick_round?: number | null
          points_earned?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          fight_id?: string
          league_id?: string
          event_id?: string
          pick_winner?: 'red' | 'blue'
          pick_method?: 'decision' | 'ko_tko' | 'submission'
          pick_round?: number | null
          points_earned?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      api_sync_log: {
        Row: {
          id: string
          sync_type: 'event_import' | 'card_update' | 'live_results' | 'validation' | 'health_check' | 'cross_validation'
          event_id: string | null
          api_source: 'espn' | 'ufc_api' | 'claude'
          status: 'success' | 'error' | 'partial' | 'warning'
          request_count: number
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          sync_type: 'event_import' | 'card_update' | 'live_results' | 'validation' | 'health_check' | 'cross_validation'
          event_id?: string | null
          api_source: 'espn' | 'ufc_api' | 'claude'
          status: 'success' | 'error' | 'partial' | 'warning'
          request_count?: number
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          sync_type?: 'event_import' | 'card_update' | 'live_results' | 'validation' | 'health_check'
          event_id?: string | null
          api_source?: 'espn' | 'claude'
          status?: 'success' | 'error' | 'partial' | 'warning'
          request_count?: number
          details?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      league_messages: {
        Row: {
          id: string
          league_id: string
          user_id: string
          content: string | null
          message_type: 'text' | 'image' | 'gif' | 'fight_card'
          image_url: string | null
          reply_to_id: string | null
          event_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          league_id: string
          user_id: string
          content?: string | null
          message_type?: 'text' | 'image' | 'gif' | 'fight_card'
          image_url?: string | null
          reply_to_id?: string | null
          event_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          user_id?: string
          content?: string | null
          message_type?: 'text' | 'image' | 'gif' | 'fight_card'
          image_url?: string | null
          reply_to_id?: string | null
          event_id?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'league_messages_league_id_fkey'; columns: ['league_id']; isOneToOne: false; referencedRelation: 'leagues'; referencedColumns: ['id'] },
          { foreignKeyName: 'league_messages_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: 'fire' | 'thumbsup' | 'laugh' | 'skull' | 'trophy'
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: 'fire' | 'thumbsup' | 'laugh' | 'skull' | 'trophy'
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: 'fire' | 'thumbsup' | 'laugh' | 'skull' | 'trophy'
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'message_reactions_message_id_fkey'; columns: ['message_id']; isOneToOne: false; referencedRelation: 'league_messages'; referencedColumns: ['id'] },
          { foreignKeyName: 'message_reactions_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
        ]
      }
      message_link_previews: {
        Row: {
          id: string
          message_id: string
          url: string
          title: string | null
          description: string | null
          image_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          url: string
          title?: string | null
          description?: string | null
          image_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          url?: string
          title?: string | null
          description?: string | null
          image_url?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: 'message_link_previews_message_id_fkey'; columns: ['message_id']; isOneToOne: false; referencedRelation: 'league_messages'; referencedColumns: ['id'] },
        ]
      }
      league_chat_reads: {
        Row: {
          user_id: string
          league_id: string
          last_read_at: string
        }
        Insert: {
          user_id: string
          league_id: string
          last_read_at?: string
        }
        Update: {
          user_id?: string
          league_id?: string
          last_read_at?: string
        }
        Relationships: [
          { foreignKeyName: 'league_chat_reads_user_id_fkey'; columns: ['user_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] },
          { foreignKeyName: 'league_chat_reads_league_id_fkey'; columns: ['league_id']; isOneToOne: false; referencedRelation: 'leagues'; referencedColumns: ['id'] },
        ]
      }
      espn_health: {
        Row: {
          id: string
          endpoint: string
          consecutive_failures: number
          last_success_at: string | null
          last_failure_at: string | null
          last_error: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          endpoint: string
          consecutive_failures?: number
          last_success_at?: string | null
          last_failure_at?: string | null
          last_error?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          endpoint?: string
          consecutive_failures?: number
          last_success_at?: string | null
          last_failure_at?: string | null
          last_error?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>
    Functions: {
      calculate_pick_points: {
        Args: {
          p_pick_winner: string
          p_pick_method: string
          p_pick_round: number | null
          p_result_winner: string
          p_result_method: string
          p_result_round: number | null
        }
        Returns: number
      }
      recalculate_event_picks: {
        Args: { p_event_id: string }
        Returns: number
      }
    }
    Enums: Record<string, never>
  }
}
