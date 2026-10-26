import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { transcriptSegmentSchema } from "@/features/voz/schema";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";

/** Fila tipada de `transcript_segments` (tipos regenerados tras la migración 011, R1 aplicada). */
type TranscriptSegmentRow = Database["public"]["Tables"]["transcript_segments"]["Row"];

/**
 * Tramos de transcripción del modo de escucha (D10 del diseño, FR-031 · FR-055 · US6-AC12).
 *
 * Cada tramo persiste con su marca de confiabilidad (`quality`): de los `insufficient` no se
 * derivan antecedentes (FR-031 · US6-AC7). `processing_state` hace explícito el estado del tramo
 * — `pending` hasta resolverse en `processed` o `discarded` —, de modo que una interrupción deja
 * todo tramo en estado definido y ninguno a medio procesar (FR-055 · US6-AC12). El audio, solo con
 * el modo real, vive en Storage y el tramo guarda su ruta (`audio_path`, D4 del cambio
 * implementar-asr-real-captura-voz).
 */

export type ProcessingState = "pending" | "processed" | "discarded";

export type TranscriptSegmentEntry = {
  id: string;
  listenSessionId: string;
  clinicId: string;
  seq: number;
  startedAt: string;
  endedAt: string;
  text: string;
  quality: "ok" | "insufficient";
  processingState: ProcessingState;
  /** Ruta del audio en Storage (D4 del cambio implementar-asr-real-captura-voz); nulo en simulación. */
  audioPath: string | null;
  createdAt: string;
};

const settleStateSchema = z.enum(["processed", "discarded"]);

function aTramo(fila: TranscriptSegmentRow): TranscriptSegmentEntry {
  const tramo: TranscriptSegmentEntry = {
    id: fila.id,
    listenSessionId: fila.listening_session_id,
    clinicId: fila.clinic_id,
    seq: fila.seq,
    startedAt: fila.started_at,
    endedAt: fila.ended_at,
    text: fila.text,
    quality: transcriptSegmentSchema.shape.quality.parse(fila.quality),
    processingState: transcriptSegmentSchema.shape.processingState.parse(fila.processing_state),
    audioPath: fila.audio_path ?? null,
    createdAt: fila.created_at,
  };
  return tramo;
}

export async function saveTranscriptSegment(
  client: SupabaseClient<Database>,
  input: Omit<TranscriptSegmentEntry, "id" | "processingState" | "createdAt" | "audioPath"> & {
    audioPath?: string;
  },
): Promise<TranscriptSegmentEntry> {
  const requestId = makeRequestId();
  try {
    const tramo = transcriptSegmentSchema.parse({ ...input, processingState: "pending" });
    const { data, error } = await client
      .from("transcript_segments")
      .insert({
        listening_session_id: tramo.listenSessionId,
        clinic_id: tramo.clinicId,
        seq: tramo.seq,
        started_at: tramo.startedAt,
        ended_at: tramo.endedAt,
        text: tramo.text,
        quality: tramo.quality,
        ...(input.audioPath ? { audio_path: input.audioPath } : {}),
      })
      .select()
      .single();
    if (error) {
      throw error;
    }
    logEvent("voz.transcript_segment_saved", {
      requestId,
      operation: "saveTranscriptSegment",
    });
    return aTramo(data as TranscriptSegmentRow);
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "saveTranscriptSegment",
      requestId,
    });
    throw error;
  }
}

export async function settleTranscriptSegment(
  client: SupabaseClient<Database>,
  input: {
    segmentId: string;
    processingState: "processed" | "discarded";
    /** Descarte por fallo de subida: el tramo no conserva un audio_path que apunta a nada (021). */
    clearAudioPath?: boolean;
  },
): Promise<TranscriptSegmentEntry> {
  const requestId = makeRequestId();
  try {
    const resuelto = settleStateSchema.parse(input.processingState);
    const { data, error } = await client
      .from("transcript_segments")
      .update({ processing_state: resuelto, ...(input.clearAudioPath ? { audio_path: null } : {}) })
      .eq("id", input.segmentId)
      .select()
      .single();
    if (error) {
      throw error;
    }
    logEvent("voz.transcript_segment_settled", {
      requestId,
      operation: "settleTranscriptSegment",
    });
    return aTramo(data as TranscriptSegmentRow);
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "settleTranscriptSegment",
      requestId,
    });
    throw error;
  }
}

export async function listTranscriptSegments(
  client: SupabaseClient<Database>,
  listenSessionId: string,
): Promise<TranscriptSegmentEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("transcript_segments")
      .select("*")
      .eq("listening_session_id", listenSessionId)
      .order("seq", { ascending: true });
    if (error) {
      throw error;
    }
    const filas = (data ?? []) as TranscriptSegmentRow[];
    return filas.map((fila) => aTramo(fila));
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listTranscriptSegments",
      requestId,
    });
    throw error;
  }
}
