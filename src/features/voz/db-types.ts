import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Seam de tipado de las tablas de la captura de voz (requisito de integración R1 del diseño).
 *
 * `src/lib/supabase/database.types.ts` es archivo compartido y está fuera de este alcance: sus
 * tipos se regeneran en integración (`supabase gen types`) tras la migración 011. Este módulo
 * contiene los tipos generados equivalentes para `listening_sessions` y `transcript_segments`, y
 * se ELIMINA al aplicar R1 (junto con `asVozClient`).
 */

export type ListeningSessionRow = {
  id: string;
  clinic_id: string;
  consultation_id: string;
  started_by: string;
  started_at: string;
  ended_at: string | null;
  state: "active" | "stopped" | "interrupted";
};

export type TranscriptSegmentRow = {
  id: string;
  listening_session_id: string;
  clinic_id: string;
  seq: number;
  started_at: string;
  ended_at: string;
  text: string;
  quality: "ok" | "insufficient";
  processing_state: "pending" | "processed" | "discarded";
  created_at: string;
};

type ListeningSessionsTable = {
  Row: ListeningSessionRow;
  Insert: Partial<ListeningSessionRow> & { clinic_id: string; consultation_id: string };
  Update: Partial<ListeningSessionRow>;
  Relationships: [];
};

type TranscriptSegmentsTable = {
  Row: TranscriptSegmentRow;
  Insert: Partial<TranscriptSegmentRow> & {
    listening_session_id: string;
    clinic_id: string;
    seq: number;
    started_at: string;
    ended_at: string;
    text: string;
    quality: "ok" | "insufficient";
  };
  Update: Partial<TranscriptSegmentRow>;
  Relationships: [];
};

export type VozDatabase = Database & {
  public: {
    Tables: {
      listening_sessions: ListeningSessionsTable;
      transcript_segments: TranscriptSegmentsTable;
    };
  };
};

/**
 * Amplía el cliente tipado con las tablas 011 pendientes de R1. Cast documentado (el compilador
 * no puede unificar ambos `Database` sin los tipos regenerados); desaparece al aplicar R1.
 */
export function asVozClient(client: SupabaseClient<Database>): SupabaseClient<VozDatabase> {
  // Tipos idénticos a los que emitirá `supabase gen types` para la migración 011 (R1).
  const conTablasVoz = client as unknown as SupabaseClient<VozDatabase>;
  return conTablasVoz;
}
