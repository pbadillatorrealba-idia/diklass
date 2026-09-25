import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRows } from "@/features/registro/read-rows";
import type { AnamnesisField } from "@/features/registro/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
import {
  type AudioFactContent,
  audioFactContentSchema,
  type ExtractedFactDraft,
} from "@/features/voz/schema";
import { createClinicalRecords, updateClinicalContent } from "@/lib/attribution/clinical-mutations";
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
    const contenidos = input.drafts.map((propuesta) =>
      audioFactContentSchema.parse({
        consultationId: input.consultationId,
        field: propuesta.field,
        text: propuesta.text,
        provenance: "inferida",
        confirmationState: "pending",
        transcriptSegmentId: input.transcriptSegmentId,
        transcriptExcerpt: input.segmentText.slice(propuesta.excerptStart, propuesta.excerptEnd),
        segmentSeq: input.segmentSeq,
        contradiction: propuesta.contradiction ?? null,
      }),
    );
    // SC-028 (revisión de la PR #29): un único INSERT atómico por tramo. Los borradores del
    // tramo nacen todos o ninguno, y el alta no relee la traza (D6: no emite evento).
    const creadas = await createClinicalRecords(
      client,
      contenidos.map((content) => ({
        clinic_id: input.clinicId,
        record_type: "audio_fact",
        content,
        status: "draft",
      })),
    );
    const hechos = creadas.map((fila) => aHecho(fila));
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
    // Revisión de la PR #29: una fila fuera de contrato se omite con log en vez de tumbar la
    // lista entera (y con ella el panel de borradores y el contexto de contradicciones).
    return parseRows(data as ClinicalRecordRow[] | null, audioFactContentSchema, "listAudioFacts");
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
    const editada = await updateClinicalContent(client, input.factId, content, {
      expectedUpdatedAt: actual.record.updated_at,
    });
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
    const descartada = await updateClinicalContent(client, factId, content, {
      expectedUpdatedAt: actual.record.updated_at,
    });
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
    // devuelve anamnesisEntryId derivado por el servidor. Con el control optimista (revisión
    // de la PR #29) se confirma exactamente el texto que se leyó: si otro veterinario lo
    // corrigió entretanto, no se escribe nada y se lanza ClinicalWriteConflictError.
    const confirmada = await updateClinicalContent(client, factId, content, {
      expectedUpdatedAt: actual.record.updated_at,
    });
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
