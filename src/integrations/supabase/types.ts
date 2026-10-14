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
      game_sessions: {
        Row: {
          code: string
          created_at: string
          director_hash: string
          game_hash: string
          game_state: Json
          game_version: number
          heartbeat_at: string | null
          id: string
          last_event_seq: number
          layout: Json
          output_hash: string
          question: Json | null
          question_key: string | null
        }
        Insert: {
          code: string
          created_at?: string
          director_hash: string
          game_hash: string
          game_state?: Json
          game_version?: number
          heartbeat_at?: string | null
          id?: string
          last_event_seq?: number
          layout?: Json
          output_hash: string
          question?: Json | null
          question_key?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          director_hash?: string
          game_hash?: string
          game_state?: Json
          game_version?: number
          heartbeat_at?: string | null
          id?: string
          last_event_seq?: number
          layout?: Json
          output_hash?: string
          question?: Json | null
          question_key?: string | null
        }
        Relationships: []
      }
      iso_events: {
        Row: {
          client_event_id: string | null
          data: Json
          id: number
          kind: string
          question_key: string | null
          seq: number | null
          session_id: string
          ts: string
        }
        Insert: {
          client_event_id?: string | null
          data?: Json
          id?: number
          kind: string
          question_key?: string | null
          seq?: number | null
          session_id: string
          ts?: string
        }
        Update: {
          client_event_id?: string | null
          data?: Json
          id?: number
          kind?: string
          question_key?: string | null
          seq?: number | null
          session_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "iso_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_plates: {
        Row: {
          color: string
          ord: number
          plate_id: string
          session_id: string
          status: string
          status_key: string | null
        }
        Insert: {
          color: string
          ord: number
          plate_id: string
          session_id: string
          status?: string
          status_key?: string | null
        }
        Update: {
          color?: string
          ord?: number
          plate_id?: string
          session_id?: string
          status?: string
          status_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iso_plates_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      iso_state: {
        Row: {
          correct_answer: string | null
          created_at: string
          locked_snapshot: Json | null
          placements: Json
          pool: string[]
          question_key: string
          resolved: boolean
          session_id: string
          version: number
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string
          locked_snapshot?: Json | null
          placements?: Json
          pool?: string[]
          question_key: string
          resolved?: boolean
          session_id: string
          version?: number
        }
        Update: {
          correct_answer?: string | null
          created_at?: string
          locked_snapshot?: Json | null
          placements?: Json
          pool?: string[]
          question_key?: string
          resolved?: boolean
          session_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "iso_state_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      iso_auth: {
        Args: { _code: string; _hash: string; _roles: string[] }
        Returns: {
          code: string
          created_at: string
          director_hash: string
          game_hash: string
          game_state: Json
          game_version: number
          heartbeat_at: string | null
          id: string
          last_event_seq: number
          layout: Json
          output_hash: string
          question: Json | null
          question_key: string | null
        }
        SetofOptions: {
          from: "*"
          to: "game_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      iso_create_session: {
        Args: { _code: string; _d: string; _g: string; _o: string }
        Returns: Json
      }
      iso_ensure_state: {
        Args: { _key: string; _sid: string }
        Returns: undefined
      }
      iso_game_publish: {
        Args: {
          _code: string
          _event: Json
          _hash: string
          _key: string
          _question: Json
          _state: Json
          _version: number
        }
        Returns: Json
      }
      iso_get: { Args: { _code: string; _hash: string }; Returns: Json }
      iso_get_events: { Args: { _code: string; _hash: string }; Returns: Json }
      iso_heartbeat: { Args: { _code: string; _hash: string }; Returns: Json }
      iso_log: {
        Args: {
          _ceid?: string
          _data: Json
          _key: string
          _kind: string
          _seq?: number
          _sid: string
        }
        Returns: undefined
      }
      iso_notify: { Args: { _code: string }; Returns: undefined }
      iso_place: {
        Args: {
          _code: string
          _correction: boolean
          _expected: number
          _hash: string
          _key: string
          _note: string
          _plate: string
          _target: string
          _undo: boolean
        }
        Returns: Json
      }
      iso_resolve: {
        Args: { _key: string; _sid: string; _use_current: boolean }
        Returns: Json
      }
      iso_set_layout: {
        Args: { _code: string; _hash: string; _layout: Json }
        Returns: Json
      }
      iso_set_plate_status: {
        Args: {
          _code: string
          _hash: string
          _note: string
          _plate: string
          _status: string
        }
        Returns: Json
      }
      iso_snapshot: { Args: { _key: string; _sid: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
