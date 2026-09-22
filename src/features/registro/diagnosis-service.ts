import type { SupabaseClient } from "@supabase/supabase-js";
import { type DiagnosisContent, diagnosisContentSchema } from "@/features/registro/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
import { createClinicalRecord } from "@/lib/attribution/clinical-mutations";
import type { ClinicalMutationResult } from "@/lib/attribution/types";
import {
  captureClientError,
  type ErrorReporterClient,
  makeRequestId,
} from "@/lib/observability/client-error-reporter";
import { logEvent } from "@/lib/observability/logger";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Diagnóstico registrado por el veterinario durante la consulta (US3-AC1).
 *
 * Es material de trabajo de la consulta: la epicrisis lo recoge después en su campo
 * `diagnostico` (D3). Escrituras solo por el contrato de atribución (D9), errores sin envolver
 * (`isAuthenticationRequired`) y `requestId` por operación (Constitución IV).
 */

/** Diagnóstico leído desde la traza clínica: fila cruda y contenido validado. */
export type DiagnosisEntry = { record: ClinicalRecordRow; content: DiagnosisContent };

export async function recordDiagnosis(
  client: SupabaseClient<Database>,
  input: { clinicId: string; consultationId: string; text: string },
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const content = diagnosisContentSchema.parse({
      consultationId: input.consultationId,
      text: input.text,
    });
    const registrado = await createClinicalRecord(client, {
      clinic_id: input.clinicId,
      record_type: "diagnosis",
      content,
      status: "draft",
    });
    logEvent("registro.diagnosis_recorded", { requestId, operation: "recordDiagnosis" });
    return registrado;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "recordDiagnosis",
      requestId,
    });
    throw error;
  }
}

export async function listDiagnoses(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<DiagnosisEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "diagnosis")
      .eq("content->>consultationId", consultationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => ({
      record: row,
      content: diagnosisContentSchema.parse(row.content),
    }));
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listDiagnoses",
      requestId,
    });
    throw error;
  }
}
