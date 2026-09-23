import type { SupabaseClient } from "@supabase/supabase-js";
import { getConsultation } from "@/features/registro/consultation-service";

import { listeningSessionSchema } from "@/features/voz/schema";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";

/** Fila tipada de `listening_sessions` (tipos regenerados tras la migración 011, R1 aplicada). */
type ListeningSessionRow = Database["public"]["Tables"]["listening_sessions"]["Row"];

/**
 * Sesiones de escucha clínica (D8 del diseño, FR-014 · FR-025 · FR-068).
 *
 * La activación queda atribuida por servidor (`started_by`/`started_at`, columnas no escribibles
 * por el cliente) y NUNCA se inicia sin consulta abierta (FR-014 · US6-AC14). Detener deja el
 * término registrado y el estado `stopped`; una interrupción a mitad de tramo, `interrupted`
 * (US6-AC12). Los errores viajan sin envolver (`isAuthenticationRequired`) y cada operación lleva
 * su `requestId` (Constitución IV).
 */

export type ListenSessionState = "active" | "stopped" | "interrupted";

export type ListeningSessionEntry = {
  id: string;
  clinicId: string;
  consultationId: string;
  startedBy: string;
  startedAt: string;
  endedAt: string | null;
  state: ListenSessionState;
};

function aSesiónDeEscucha(fila: ListeningSessionRow): ListeningSessionEntry {
  const sesión: ListeningSessionEntry = {
    id: fila.id,
    clinicId: fila.clinic_id,
    consultationId: fila.consultation_id,
    startedBy: fila.started_by,
    startedAt: fila.started_at,
    endedAt: fila.ended_at,
    state: listeningSessionSchema.shape.state.parse(fila.state),
  };
  return sesión;
}

export async function startListenSession(
  client: SupabaseClient<Database>,
  input: { clinicId: string; consultationId: string },
): Promise<ListeningSessionEntry> {
  const requestId = makeRequestId();
  try {
    const planeada = listeningSessionSchema.parse({
      clinicId: input.clinicId,
      consultationId: input.consultationId,
      state: "active",
    });
    const consulta = await getConsultation(client, planeada.consultationId);
    if (consulta?.content.status !== "open") {
      throw new Error("La escucha clínica requiere una consulta abierta (FR-014 · US6-AC14).");
    }
    const { data, error } = await client
      .from("listening_sessions")
      .insert({ clinic_id: planeada.clinicId, consultation_id: planeada.consultationId })
      .select()
      .single();
    if (error) {
      throw error;
    }
    logEvent("voz.listen_session_started", {
      requestId,
      operation: "startListenSession",
    });
    return aSesiónDeEscucha(data as ListeningSessionRow);
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "startListenSession",
      requestId,
    });
    throw error;
  }
}

export async function endListenSession(
  client: SupabaseClient<Database>,
  input: { sessionId: string; state: "stopped" | "interrupted" },
): Promise<ListeningSessionEntry> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("listening_sessions")
      .update({ state: input.state, ended_at: new Date().toISOString() })
      .eq("id", input.sessionId)
      .select()
      .single();
    if (error) {
      throw error;
    }
    logEvent("voz.listen_session_ended", {
      requestId,
      operation: "endListenSession",
    });
    return aSesiónDeEscucha(data as ListeningSessionRow);
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "endListenSession",
      requestId,
    });
    throw error;
  }
}

export async function listListenSessions(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<ListeningSessionEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("listening_sessions")
      .select("*")
      .eq("consultation_id", consultationId)
      .order("started_at", { ascending: true });
    if (error) {
      throw error;
    }
    const filas = (data ?? []) as ListeningSessionRow[];
    return filas.map((fila) => aSesiónDeEscucha(fila));
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listListenSessions",
      requestId,
    });
    throw error;
  }
}
