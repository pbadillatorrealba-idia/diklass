import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnamnesisField } from "@/features/registro/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
import {
  type AudioFactContent,
  audioFactContentSchema,
  type ExtractedFactDraft,
} from "@/features/voz/schema";
import { createClinicalRecord, updateClinicalContent } from "@/lib/attribution/clinical-mutations";
import type { ClinicalMutationResult } from "@/lib/attribution/types";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Hechos extraídos del audio (D1 · D5 del diseño; FR-016 · FR-017 · FR-021 · FR-068 · SC-005 ·
 * SC-027 · SC-048).
 *
 * Las propuestas de la extracción nacen como borradores `record_type = 'audio_fact'` en estado
 * `pending`, con procedencia `inferida` y su traza al fragmento de transcripción (SC-027 ·
 * US6-AC6). Cada antecedente se acepta, corrige o descarta por separado (US6-AC3); lo no
 * confirmado nunca entra a la anamnesis (SC-005 · US6-AC4). `confirmAudioFact` confirma por la
 * única ruta: la UPDATE a `confirmed`, cuyo trigger de dominio aterriza EN LA MISMA TRANSACCIÓN la
 * entrada de anamnesis de 002 con `anamnesisEntryId` derivado por el servidor (D5 · US6-AC15);
 * confirmar no altera la procedencia (FR-021 · US6-AC9). Toda mutación cruza el contrato de
 * atribución (D8 · FR-063).
 */

export type AudioFactEntry = { record: ClinicalRecordRow; content: AudioFactContent };

function aHecho(record: ClinicalRecordRow): AudioFactEntry {
  const hecho: AudioFactEntry = {
    record,
    content: audioFactContentSchema.parse(record.content),
  };
  return hecho;
}

export async function createAudioFactDrafts(
  client: SupabaseClient<Database>,
  input: {
    clinicId: string;
    consultationId: string;
    transcriptSegmentId: string;
    segmentSeq: number;
    segmentText: string;
    drafts: ExtractedFactDraft[];
  },
): Promise<AudioFactEntry[]> {
  const requestId = makeRequestId();
  try {
    const hechos: AudioFactEntry[] = [];
    for (const propuesta of input.drafts) {
      const content = audioFactContentSchema.parse({
        consultationId: input.consultationId,
        field: propuesta.field,
        text: propuesta.text,
        provenance: "inferida",
        confirmationState: "pending",
        transcriptSegmentId: input.transcriptSegmentId,
        transcriptExcerpt: input.segmentText.slice(propuesta.excerptStart, propuesta.excerptEnd),
        segmentSeq: input.segmentSeq,
        contradiction: propuesta.contradiction ?? null,
      });
      const creada: ClinicalMutationResult<ClinicalRecordRow> = await createClinicalRecord(client, {
        clinic_id: input.clinicId,
        record_type: "audio_fact",
        content,
        status: "draft",
      });
      hechos.push(aHecho(creada.record));
    }
    logEvent("voz.audio_fact_drafts_created", {
      requestId,
      operation: "createAudioFactDrafts",
    });
    return hechos;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "createAudioFactDrafts",
      requestId,
    });
    throw error;
  }
}

export async function listAudioFacts(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<AudioFactEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "audio_fact")
      .eq("content->>consultationId", consultationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    const filas = (data ?? []) as ClinicalRecordRow[];
    return filas.map((fila) => aHecho(fila));
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listAudioFacts",
      requestId,
    });
    throw error;
  }
}

async function leerHecho(
  client: SupabaseClient<Database>,
  factId: string,
): Promise<AudioFactEntry> {
  const { data, error } = await client
    .from("clinical_records")
    .select("*")
    .eq("id", factId)
    .eq("record_type", "audio_fact")
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No se encontró el hecho extraído del audio.");
  }
  return aHecho(data as ClinicalRecordRow);
}

export async function editAudioFactDraft(
  client: SupabaseClient<Database>,
  input: { factId: string; text?: string; field?: AnamnesisField },
): Promise<AudioFactEntry> {
  const requestId = makeRequestId();
  try {
    const actual = await leerHecho(client, input.factId);
    const content = audioFactContentSchema.parse({
      ...actual.content,
      text: input.text ?? actual.content.text,
      field: input.field ?? actual.content.field,
    });
    const editada = await updateClinicalContent(client, input.factId, content);
    logEvent("voz.audio_fact_draft_edited", {
      requestId,
      operation: "editAudioFactDraft",
    });
    return aHecho(editada.record);
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "editAudioFactDraft",
      requestId,
    });
    throw error;
  }
}

export async function discardAudioFactDraft(
  client: SupabaseClient<Database>,
  factId: string,
): Promise<AudioFactEntry> {
  const requestId = makeRequestId();
  try {
    const actual = await leerHecho(client, factId);
    const content = audioFactContentSchema.parse({
      ...actual.content,
      confirmationState: "discarded",
    });
    const descartada = await updateClinicalContent(client, factId, content);
    logEvent("voz.audio_fact_draft_discarded", {
      requestId,
      operation: "discardAudioFactDraft",
    });
    return aHecho(descartada.record);
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "discardAudioFactDraft",
      requestId,
    });
    throw error;
  }
}

export async function confirmAudioFact(
  client: SupabaseClient<Database>,
  factId: string,
): Promise<{ fact: AudioFactEntry; landedEntryId: string }> {
  const requestId = makeRequestId();
  try {
    const actual = await leerHecho(client, factId);
    if (actual.content.confirmationState !== "pending") {
      throw new Error("Solo se puede confirmar un hecho pendiente (D5 · estados terminales).");
    }
    const content = audioFactContentSchema.parse({
      ...actual.content,
      confirmationState: "confirmed",
    });
    // D5: esta UPDATE aterriza la anamnesis en su misma transacción (trigger de dominio) y
    // devuelve anamnesisEntryId derivado por el servidor.
    const confirmada = await updateClinicalContent(client, factId, content);
    const resultado = aHecho(confirmada.record);
    const landedEntryId = resultado.content.anamnesisEntryId;
    if (!landedEntryId) {
      throw new Error(
        "Confirmación sin anamnesisEntryId: violación de la garantía de aterrizaje del servidor (SC-027).",
      );
    }
    logEvent("voz.audio_fact_confirmed", {
      requestId,
      operation: "confirmAudioFact",
    });
    return { fact: resultado, landedEntryId };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "confirmAudioFact",
      requestId,
    });
    throw error;
  }
}
