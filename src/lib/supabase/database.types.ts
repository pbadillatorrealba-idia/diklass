export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      clinics: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      veterinarians: {
        Row: {
          id: string;
          clinic_id: string;
          identifier: string;
          display_name: string;
          provisioned_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          clinic_id: string;
          identifier: string;
          display_name: string;
          provisioned_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["veterinarians"]["Insert"]>;
        Relationships: [];
      };
      access_sessions: {
        Row: {
          id: string;
          token_hash: string;
          veterinarian_id: string;
          created_at: string;
          last_activity_at: string;
          expires_at: string;
          revoked_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      clinical_audit_events: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          actor_id: string;
          occurred_at: string;
          supersedes_event_id: string | null;
          metadata: Json;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      clinical_records: {
        Row: {
          id: string;
          clinic_id: string;
          record_type: string;
          content: Json;
          status: string;
          supersedes_event_id: string | null;
          created_by: string;
          created_at: string;
          updated_by: string | null;
          updated_at: string | null;
          approved_at: string | null;
          approved_by: string | null;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          record_type: string;
          content?: Json;
          status?: string;
          supersedes_event_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_by?: string | null;
          updated_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["clinical_records"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      start_access_session: { Args: Record<string, never>; Returns: Json };
      touch_access_session: { Args: { p_session_id: string }; Returns: boolean };
      revoke_access_session: { Args: { p_session_id?: string }; Returns: boolean };
      revoke_access_sessions: { Args: Record<string, never>; Returns: boolean };
      approve_clinical_record: { Args: { p_record_id: string }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
