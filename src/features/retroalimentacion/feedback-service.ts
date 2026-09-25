import type { SupabaseClient } from "@supabase/supabase-js";
import { consultationContentSchema } from "@/features/registro/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
import type { FeedbackEntry } from "@/features/retroalimentacion/feedback-summary";
import { type FeedbackContent, feedbackContentSchema } from "@/features/retroalimentacion/schema";
import { createClinicalRecord, createCorrectiveRecord } from "@/lib/attribution/clinical-mutations";
import type { ClinicalMutationResult } from "@/lib/attribution/types";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Puerta de escritura de la retroalimentación clínica (FR-018, FR-024, FR-039, FR-070).
 *
 * Toda mutación cruza el contrato de atribución (contrato de `src/lib/attribution`, guardas
 * `ATTRIBUTION_CONTROL_FIELDS`) y el servidor revalida el contenido y la referencia a la
 * consulta (D5 del diseño de este cambio): aquí el Zod es comodidad del cliente, nunca control.
 */

/**
 * Registro de una entrada de retroalimentación sobre una consulta cerrada (D3: «entre
 * consultas»; FR-018 · US10-AC1). La fecha de registro la fija el servidor (FR-039 ·
 * US10-AC7) y la atribución se relee de la traza (FR-070 · SC-049).
 */
export async function createFeedbackEntry(
  client: SupabaseClient<Database>,
  input: { clinicId: string; content: FeedbackContent },
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const contenido = feedbackContentSchema.parse(input.content);

    const { data: filaConsulta, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", contenido.consultationId)
      .eq("record_type", "consultation")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (filaConsulta?.record_type !== "consultation") {
      throw new Error("No se encontró la consulta referida.");
    }
    const consulta = consultationContentSchema.parse(filaConsulta.content);
    if (consulta.status !== "closed") {
      throw new Error("La retroalimentación se registra solo sobre consultas cerradas.");
    }

    const registro = await createClinicalRecord(client, {
      clinic_id: input.clinicId,
      record_type: "clinical_feedback",
      content: contenido,
      status: "draft",
    });
    logEvent("retroalimentacion.feedback_recorded", {
      requestId,
      operation: "createFeedbackEntry",
    });
    return registro;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "createFeedbackEntry",
      requestId,
    });
    throw error;
  }
}

/**
 * Corrección de una entrada ya registrada (FR-024 · SC-022 · US10-AC5): crea un registro
 * ADICIONAL con `status` 'corrective' y conserva el original legible e intocable (D4). La
 * corrección resuelve al evento `clinical_feedback_recorded` del original aunque se corrija
 * una correctiva (D7: las sucesivas apuntan al mismo evento) y no puede reasociar la entrada
 * a otra consulta: eso sería otra entrada, no una corrección.
 */
export async function correctFeedbackEntry(
  client: SupabaseClient<Database>,
  feedbackRecordId: string,
  content: FeedbackContent,
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const contenido = feedbackContentSchema.parse(content);

    const { data: original, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", feedbackRecordId)
      .eq("record_type", "clinical_feedback")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (original?.record_type !== "clinical_feedback") {
      throw new Error("No se encontró la entrada de retroalimentación.");
    }
    const contenidoOriginal = feedbackContentSchema.parse(original.content);
    if (contenidoOriginal.consultationId !== contenido.consultationId) {
      throw new Error("La corrección pertenece a otra consulta.");
    }

    // D7: toda corrección apunta al evento de registro del original. Si lo que se corrige ya
    // es una correctiva, su `supersedes_event_id` es ese mismo evento (D8 de 002).
    let supersedesEventId = original.supersedes_event_id;
    if (supersedesEventId === null) {
      // Columna líder del índice (entity_type, entity_id, occurred_at) y una sola fila: el
      // registro de un original emite exactamente un `clinical_feedback_recorded`.
      const { data: evento, error: errorEvento } = await client
        .from("clinical_audit_events")
        .select("id")
        .eq("entity_type", "clinical_feedback")
        .eq("entity_id", feedbackRecordId)
        .eq("action", "clinical_feedback_recorded")
        .limit(1)
        .maybeSingle();
      if (errorEvento) {
        throw errorEvento;
      }
      supersedesEventId = evento?.id ?? null;
    }
    if (supersedesEventId === null) {
      throw new Error("No se encontró el evento de registro de la entrada de retroalimentación.");
    }

    const correctiva = await createCorrectiveRecord(client, {
      clinicId: original.clinic_id,
      recordType: "clinical_feedback",
      content: contenido,
      supersedesEventId,
    });
    logEvent("retroalimentacion.feedback_corrected", {
      requestId,
      operation: "correctFeedbackEntry",
    });
    return correctiva;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "correctFeedbackEntry",
      requestId,
    });
    throw error;
  }
}

/**
 * Composición de entradas leídas (patrón de resiliencia de 002): el contenido ilegible se
 * salta con log estructurado y no rompe la lectura del resto.
 */
function componerEntradas(
  rows: ClinicalRecordRow[],
  originales: Map<string, string>,
  operation: string,
): FeedbackEntry[] {
  return rows.flatMap((row) => {
    const legible = feedbackContentSchema.safeParse(row.content);
    if (!legible.success) {
      logEvent(
        "retroalimentacion.row_content_skipped",
        { operation, recordId: row.id, errorName: "ZodError" },
        "error",
      );
      return [];
    }
    const eventoCorregido = row.supersedes_event_id;
    return [
      {
        record: row,
        content: legible.data,
        correctsRecordId:
          (eventoCorregido === null ? undefined : originales.get(eventoCorregido)) ?? null,
      },
    ];
  });
}

/**
 * Resolución de la cadena de correcciones (D7): `supersedes_event_id` de cada correctiva →
 * `entity_id` del evento = id del registro original. Una consulta simple e indexada por PK.
 */
async function resolverOriginales(
  client: SupabaseClient<Database>,
  rows: ClinicalRecordRow[],
): Promise<Map<string, string>> {
  const originales = new Map<string, string>();
  const eventos = [
    ...new Set(
      rows
        .map((row) => row.supersedes_event_id)
        .filter((eventoId): eventoId is string => eventoId !== null),
    ),
  ];
  if (eventos.length === 0) {
    return originales;
  }

  const { data, error } = await client
    .from("clinical_audit_events")
    .select("id, entity_id")
    .in("id", eventos);
  if (error) {
    throw error;
  }
  for (const evento of data ?? []) {
    originales.set(evento.id, evento.entity_id);
  }
  return originales;
}

/**
 * Entradas de retroalimentación de una consulta, en lectura tolerante con la cadena de
 * correcciones resuelta (FR-056 · FR-024 · US10-AC5 · D7). El orden cronológico lo garantiza
 * la consulta (created_at, id) y lo refina `buildFeedbackTimeline`.
 */
export async function listFeedbackByConsultation(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<FeedbackEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "clinical_feedback")
      .eq("content->>consultationId", consultationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    const rows = data ?? [];
    const entradas = componerEntradas(
      rows,
      await resolverOriginales(client, rows),
      "listFeedbackByConsultation",
    );
    logEvent("retroalimentacion.feedback_listed", {
      requestId,
      operation: "listFeedbackByConsultation",
    });
    return entradas;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listFeedbackByConsultation",
      requestId,
    });
    throw error;
  }
}

/**
 * Retroalimentación de varias consultas —las de un paciente— (FR-043 · SC-023 · US10-AC9 ·
 * FR-042): es el insumo del agregado por categoría y de los antecedentes de seguimiento. Recibe
 * los ids de consulta que la pantalla ya leyó (revisión de la PR #28: sin repetir
 * `listConsultationsByPatient`) y resuelve las entradas por el índice de `consultationId` (D8:
 * sin índices nuevos).
 */
export async function listFeedbackByConsultations(
  client: SupabaseClient<Database>,
  consultationIds: string[],
): Promise<FeedbackEntry[]> {
  if (consultationIds.length === 0) {
    return [];
  }
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "clinical_feedback")
      .in("content->>consultationId", consultationIds)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    const rows = data ?? [];
    const entradas = componerEntradas(
      rows,
      await resolverOriginales(client, rows),
      "listFeedbackByConsultations",
    );
    logEvent("retroalimentacion.feedback_listed", {
      requestId,
      operation: "listFeedbackByConsultations",
    });
    return entradas;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listFeedbackByConsultations",
      requestId,
    });
    throw error;
  }
}
