export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      daily_totals: {
        Row: {
          points: number
          rank: number
          season_id: string
          slot: number
          total_date: string
        }
        Insert: {
          points: number
          rank: number
          season_id: string
          slot: number
          total_date: string
        }
        Update: {
          points?: number
          rank?: number
          season_id?: string
          slot?: number
          total_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_totals_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_board: {
        Row: {
          created_at: string
          draft_id: string
          label: string | null
          nhl_id: number | null
          pick_no: number
        }
        Insert: {
          created_at?: string
          draft_id: string
          label?: string | null
          nhl_id?: number | null
          pick_no: number
        }
        Update: {
          created_at?: string
          draft_id?: string
          label?: string | null
          nhl_id?: number | null
          pick_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "draft_board_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_picks: {
        Row: {
          name: string
          nhl_id: number
          pick_no: number
          pos: string | null
          preseason_proj: number | null
          round: number
          season_id: string
          slot: number
          team: string | null
        }
        Insert: {
          name: string
          nhl_id: number
          pick_no: number
          pos?: string | null
          preseason_proj?: number | null
          round: number
          season_id: string
          slot: number
          team?: string | null
        }
        Update: {
          name?: string
          nhl_id?: number
          pick_no?: number
          pos?: string | null
          preseason_proj?: number | null
          round?: number
          season_id?: string
          slot?: number
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "draft_picks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      drafts: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          order_locked_at: string | null
          rounds: number
          team_names: Json
          teams: number
        }
        Insert: {
          created_at?: string
          id: string
          is_current?: boolean
          order_locked_at?: string | null
          rounds?: number
          team_names?: Json
          teams?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          order_locked_at?: string | null
          rounds?: number
          team_names?: Json
          teams?: number
        }
        Relationships: []
      }
      model_meta: {
        Row: {
          data: Json
          key: string
        }
        Insert: {
          data: Json
          key: string
        }
        Update: {
          data?: Json
          key?: string
        }
        Relationships: []
      }
      player_games: {
        Row: {
          assists: number
          game_date: string
          game_id: number
          goals: number
          home: boolean | null
          nhl_id: number
          opp: string | null
          team: string | null
        }
        Insert: {
          assists?: number
          game_date: string
          game_id: number
          goals?: number
          home?: boolean | null
          nhl_id: number
          opp?: string | null
          team?: string | null
        }
        Update: {
          assists?: number
          game_date?: string
          game_id?: number
          goals?: number
          home?: boolean | null
          nhl_id?: number
          opp?: string | null
          team?: string | null
        }
        Relationships: []
      }
      player_model: {
        Row: {
          data: Json
          nhl_id: number
        }
        Insert: {
          data: Json
          nhl_id: number
        }
        Update: {
          data?: Json
          nhl_id?: number
        }
        Relationships: []
      }
      players: {
        Row: {
          last_a: number | null
          last_g: number | null
          last_gp: number | null
          last_pts: number | null
          name: string
          nhl_id: number
          pos: string | null
          team: string | null
        }
        Insert: {
          last_a?: number | null
          last_g?: number | null
          last_gp?: number | null
          last_pts?: number | null
          name: string
          nhl_id: number
          pos?: string | null
          team?: string | null
        }
        Update: {
          last_a?: number | null
          last_g?: number | null
          last_gp?: number | null
          last_pts?: number | null
          name?: string
          nhl_id?: number
          pos?: string | null
          team?: string | null
        }
        Relationships: []
      }
      pool_teams: {
        Row: {
          name: string
          season_id: string
          slot: number
        }
        Insert: {
          name: string
          season_id: string
          slot: number
        }
        Update: {
          name?: string
          season_id?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "pool_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_moves: {
        Row: {
          created_at: string
          id: string
          in_id: number
          in_name: string | null
          move_date: string
          out_id: number
          season_id: string
          slot: number
        }
        Insert: {
          created_at?: string
          id?: string
          in_id: number
          in_name?: string | null
          move_date: string
          out_id: number
          season_id: string
          slot: number
        }
        Update: {
          created_at?: string
          id?: string
          in_id?: number
          in_name?: string | null
          move_date?: string
          out_id?: number
          season_id?: string
          slot?: number
        }
        Relationships: [
          {
            foreignKeyName: "roster_moves_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          count_from: string
          id: string
          is_current: boolean
          last_synced_at: string | null
          nhl_season: number
          order_locked_at: string | null
          season_games: number
          swaps_per_team: number
        }
        Insert: {
          count_from: string
          id: string
          is_current?: boolean
          last_synced_at?: string | null
          nhl_season: number
          order_locked_at?: string | null
          season_games?: number
          swaps_per_team?: number
        }
        Update: {
          count_from?: string
          id?: string
          is_current?: boolean
          last_synced_at?: string | null
          nhl_season?: number
          order_locked_at?: string | null
          season_games?: number
          swaps_per_team?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warroom_prefs: {
        Row: {
          data: Json
          draft_id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          draft_id: string
          updated_at?: string
        }
        Update: {
          data?: Json
          draft_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warroom_prefs_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      start_draft: { Args: { _id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
    },
  },
} as const
