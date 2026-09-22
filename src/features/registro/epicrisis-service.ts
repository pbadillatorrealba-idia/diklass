import type { SupabaseClient } from "@supabase/supabase-js";
import { listAnamnesisEntries } from "@/features/registro/anamnesis-service";
import { listDiagnoses } from "@/features/registro/diagnosis-service";
import { buildEpicrisisDraft } from "@/features/registro/epicrisis-draft";
import { getPatient } from "@/features/registro/ficha-service";
import {
  consultationContentSchema,
  type EpicrisisContent,
  epicrisisContentSchema,
} from "@/features/registro/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
import {
  approveClinicalRecord,
  createClinicalRecord,
  createCorrectiveRecord,
  updateClinicalContent,
} from "@/lib/attribution/clinical-mutations";
import type { ClinicalMutationResult } from "@/lib/attribution/types";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Flujo de la epicrisis: borrador, aprobación y corrección (FR-010, FR-011, FR-012, FR-045).
 *
 * - `generateEpicrisisDraft` carga la sesión (anamnesis, diagnósticos y ficha) y ensambla el
 *   borrador con `buildEpicrisisDraft` (D3, US3-AC1); nada de lo que produce entra al
 *   historial sin la validación del veterinario (FR-010).
 * - `approveEpicrisis` usa la única ruta sancionada del servidor (RPC `approve_clinical_record`,
 *   que cierra la consulta vinculada en la misma transacción; D4 · US3-AC2).
 * - `correctEpicrisis` crea un registro ADICIONAL `corrective` que apunta al evento
 *   `epicrisis_approved` original (D8): las correctivas sucesivas apuntan al MISMO evento y el
 *   original permanece legible e intocable (FR-024 · US3-AC4).
 *
 * Errores sin envolver (`isAuthenticationRequired`) y `requestId` por operación (Const. IV).
 */

/** Epicrisis leída desde la traza clínica: fila cruda y contenido ya validado. */
export type EpicrisisEntry = { record: ClinicalRecordRow; content: EpicrisisContent };

export async function generateEpicrisisDraft(
  client: SupabaseClient<Database>,
  input: { clinicId: string; consultationId: string },
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const { data: filaConsulta, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", input.consultationId)
      .eq("record_type", "consultation")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!filaConsulta) {
      throw new Error("No se encontró la consulta.");
    }
    const consulta = consultationContentSchema.parse(filaConsulta.content);

    const paciente = await getPatient(client, consulta.patientId);
    const anamnesis = await listAnamnesisEntries(client, input.consultationId);
    const diagnoses = await listDiagnoses(client, input.consultationId);

    const content = epicrisisContentSchema.parse(
      buildEpicrisisDraft({
        consultationId: input.consultationId,
        anamnesis: anamnesis.map((entrada) => entrada.content),
        diagnoses: diagnoses.map((registro) => registro.content),
        ficha: paciente?.content ?? null,
      }),
    );
    const borrador = await createClinicalRecord(client, {
      clinic_id: input.clinicId,
      record_type: "epicrisis",
      content,
      status: "draft",
    });
    logEvent("registro.epicrisis_draft_generated", {
      requestId,
      operation: "generateEpicrisisDraft",
    });
    return borrador;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "generateEpicrisisDraft",
      requestId,
    });
    throw error;
  }
}

export async function updateEpicrisisDraft(
  client: SupabaseClient<Database>,
  epicrisisId: string,
  content: EpicrisisContent,
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const contenido = epicrisisContentSchema.parse(content);
    const actualizado = await updateClinicalContent(client, epicrisisId, contenido);
    logEvent("registro.epicrisis_draft_updated", {
      requestId,
      operation: "updateEpicrisisDraft",
    });
    return actualizado;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "updateEpicrisisDraft",
      requestId,
    });
    throw error;
  }
}

export async function approveEpicrisis(
  client: SupabaseClient<Database>,
  epicrisisId: string,
): Promise<ClinicalMutationResult<{ id: string; status: string }>> {
  const requestId = makeRequestId();
  try {
    const aprobada = await approveClinicalRecord(client, epicrisisId);
    logEvent("registro.epicrisis_approved", { requestId, operation: "approveEpicrisis" });
    return aprobada;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "approveEpicrisis",
      requestId,
    });
    throw error;
  }
}

export async function correctEpicrisis(
  client: SupabaseClient<Database>,
  epicrisisId: string,
  content: EpicrisisContent,
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const contenido = epicrisisContentSchema.parse(content);
    const { data: original, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", epicrisisId)
      .eq("record_type", "epicrisis")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!original) {
      throw new Error("No se encontró la epicrisis.");
    }
    const contenidoOriginal = epicrisisContentSchema.parse(original.content);
    if (contenidoOriginal.consultationId !== contenido.consultationId) {
      throw new Error("La corrección pertenece a otra consulta.");
    }
    if (original.status === "draft") {
      throw new Error("Solo se puede corregir una epicrisis aprobada.");
    }

    // D8: toda corrección apunta al evento `epicrisis_approved` original. Si lo que se
    // corrige ya es una correctiva, su `supersedes_event_id` es ese mismo evento.
    let supersedesEventId = original.supersedes_event_id;
    if (supersedesEventId === null) {
      const { data: eventos, error: errorEventos } = await client
        .from("clinical_audit_events")
        .select("id, action")
        .eq("entity_id", epicrisisId)
        .order("occurred_at", { ascending: false });
      if (errorEventos) {
        throw errorEventos;
      }
      supersedesEventId =
        (eventos ?? []).find((evento) => evento.action === "epicrisis_approved")?.id ?? null;
    }
    if (supersedesEventId === null) {
      throw new Error("No se encontró el evento de aprobación de la epicrisis.");
    }

    const correctiva = await createCorrectiveRecord(client, {
      clinicId: original.clinic_id,
      recordType: "epicrisis",
      content: contenido,
      supersedesEventId,
    });
    logEvent("registro.corrective_record_created", { requestId, operation: "correctEpicrisis" });
    return correctiva;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "correctEpicrisis",
      requestId,
    });
    throw error;
  }
}

export async function listEpicrisisByConsultation(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<EpicrisisEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "epicrisis")
      .eq("content->>consultationId", consultationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => ({
      record: row,
      content: epicrisisContentSchema.parse(row.content),
    }));
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listEpicrisisByConsultation",
      requestId,
    });
    throw error;
  }
}
