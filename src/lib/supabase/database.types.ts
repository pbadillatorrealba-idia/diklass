export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      access_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_activity_at: string
          revoked_at: string | null
          token_hash: string
          veterinarian_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          last_activity_at?: string
          revoked_at?: string | null
          token_hash?: string
          veterinarian_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_activity_at?: string
          revoked_at?: string | null
          token_hash?: string
          veterinarian_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_sessions_veterinarian_id_fkey"
            columns: ["veterinarian_id"]
            isOneToOne: false
            referencedRelation: "veterinarians"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_audit_events: {
        Row: {
          action: string
          actor_id: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          supersedes_event_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          supersedes_event_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          supersedes_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "veterinarians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_audit_events_supersedes_event_id_fkey"
            columns: ["supersedes_event_id"]
            isOneToOne: false
            referencedRelation: "clinical_audit_events"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_records: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          clinic_id: string
          content: Json
          created_at: string
          created_by: string
          id: string
          record_type: string
          status: string
          supersedes_event_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          clinic_id: string
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          record_type: string
          status?: string
          supersedes_event_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          clinic_id?: string
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          record_type?: string
          status?: string
          supersedes_event_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_records_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "veterinarians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "veterinarians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_supersedes_event_id_fkey"
            columns: ["supersedes_event_id"]
            isOneToOne: false
            referencedRelation: "clinical_audit_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_records_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "veterinarians"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      veterinarians: {
        Row: {
          clinic_id: string
          created_at: string
          display_name: string
          id: string
          identifier: string
          provisioned_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          display_name: string
          id: string
          identifier: string
          provisioned_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          display_name?: string
          id?: string
          identifier?: string
          provisioned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "veterinarians_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_clinical_record: { Args: { p_record_id: string }; Returns: Json }
      clinical_record_action: {
        Args: {
          p_content?: Json
          p_operation: string
          p_record_type: string
          p_status: string
        }
        Returns: string
      }
      current_clinic_id: { Args: never; Returns: string }
      insert_clinical_audit_event: {
        Args: {
          p_action: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
          p_supersedes_event_id?: string
        }
        Returns: string
      }
      is_active_access: { Args: { p_user_id?: string }; Returns: boolean }
      log_server_event: {
        Args: {
          p_event: string
          p_metadata?: Json
          p_operation: string
          p_result: string
          p_started_at?: string
        }
        Returns: undefined
      }
      request_id: { Args: never; Returns: string }
      revoke_access_session: {
        Args: { p_session_id?: string }
        Returns: boolean
      }
      revoke_access_sessions: { Args: never; Returns: boolean }
      start_access_session: { Args: never; Returns: Json }
      touch_access_session: { Args: { p_session_id: string }; Returns: boolean }
    }
    Enums: {
      access_session_status: "active" | "expired" | "revoked"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      access_session_status: ["active", "expired", "revoked"],
    },
  },
  storage: {
    Enums: {},
  },
} as const

