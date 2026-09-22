import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnamnesisEntry } from "@/features/registro/anamnesis-service";
import { listAnamnesisEntries } from "@/features/registro/anamnesis-service";
import type { DiagnosisEntry } from "@/features/registro/diagnosis-service";
import { listDiagnoses } from "@/features/registro/diagnosis-service";
import type { EpicrisisEntry } from "@/features/registro/epicrisis-service";
import { listEpicrisisByConsultation } from "@/features/registro/epicrisis-service";
import {
  type ConsultationContent,
  consultationContentSchema,
} from "@/features/registro/schema";
import {
  buildFollowUpSummary,
  buildPatientHistory,
  type ClinicalRecordRow,
  type ConsultationHistoryEntry,
  type FollowUpSummary,
} from "@/features/registro/summaries";
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
 * Consultas clínicas y su línea de tiempo longitudinal (FR-002, FR-003, FR-013, FR-045).
 *
 * - `openConsultation` abre la consulta del paciente; el servidor fija la fecha y el
 *   profesional en la atribución (US2-AC1 · US2-AC6).
 * - `resumeConsultation` devuelve el contenido íntegro de una consulta NO cerrada (FR-045 ·
 *   US4-AC5): su anamnesis, sus diagnósticos y su borrador de epicrisis si existe. Nada
 *   aprobado es retomable: lo aprobado vive en el historial (D4).
 * - `listPatientTimeline` ensambla el historial cronológico y el resumen de seguimiento solo
 *   con las epicrisis efectivas de consultas cerradas (FR-010, FR-013 · D10).
 *
 * Errores sin envolver (`isAuthenticationRequired`) y `requestId` por operación (Const. IV).
 */

/** Consulta leída desde la traza clínica: fila cruda y contenido ya validado. */
export type ConsultationEntry = { record: ClinicalRecordRow; content: ConsultationContent };

/** Estado completo de una consulta en curso, tal como quedó al interrumpirla (FR-045). */
export type ConsultationSession = {
  consultation: ConsultationEntry;
  anamnesis: AnamnesisEntry[];
  diagnoses: DiagnosisEntry[];
  epicrisisDraft: EpicrisisEntry | null;
};

export async function openConsultation(
  client: SupabaseClient<Database>,
  input: { clinicId: string; patientId: string },
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const content = consultationContentSchema.parse({
      patientId: input.patientId,
      status: "open",
    });
    const abierta = await createClinicalRecord(client, {
      clinic_id: input.clinicId,
      record_type: "consultation",
      content,
      status: "draft",
    });
    logEvent("registro.consultation_opened", { requestId, operation: "openConsultation" });
    return abierta;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "openConsultation",
      requestId,
    });
    throw error;
  }
}

export async function getConsultation(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<ConsultationEntry | null> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", consultationId)
      .eq("record_type", "consultation")
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ? { record: data, content: consultationContentSchema.parse(data.content) } : null;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "getConsultation",
      requestId,
    });
    throw error;
  }
}

export async function listConsultationsByPatient(
  client: SupabaseClient<Database>,
  patientId: string,
): Promise<ConsultationEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "consultation")
      .eq("content->>patientId", patientId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).map((row) => ({
      record: row,
      content: consultationContentSchema.parse(row.content),
    }));
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listConsultationsByPatient",
      requestId,
    });
    throw error;
  }
}

export async function resumeConsultation(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<ConsultationSession | null> {
  const requestId = makeRequestId();
  try {
    const consulta = await getConsultation(client, consultationId);
    if (!consulta || consulta.content.status === "closed") {
      return null;
    }

    const anamnesis = await listAnamnesisEntries(client, consultationId);
    const diagnoses = await listDiagnoses(client, consultationId);
    const versiones = await listEpicrisisByConsultation(client, consultationId);
    const borradores = versiones.filter((version) => version.record.status === "draft");

    return {
      consultation: consulta,
      anamnesis,
      diagnoses,
      epicrisisDraft: borradores.at(-1) ?? null,
    };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "resumeConsultation",
      requestId,
    });
    throw error;
  }
}

export async function listPatientTimeline(
  client: SupabaseClient<Database>,
  patientId: string,
): Promise<{ history: ConsultationHistoryEntry[]; followUp: FollowUpSummary }> {
  const requestId = makeRequestId();
  try {
    const consultas = await listConsultationsByPatient(client, patientId);
    const consultationIds = consultas.map((entrada) => entrada.record.id);

    let epicrisis: ClinicalRecordRow[] = [];
    if (consultationIds.length > 0) {
      const { data, error } = await client
        .from("clinical_records")
        .select("*")
        .eq("record_type", "epicrisis")
        .in("content->>consultationId", consultationIds)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });
      if (error) {
        throw error;
      }
      epicrisis = data ?? [];
    }

    const history = buildPatientHistory({
      consultations: consultas.map((entrada) => entrada.record),
      epicrisis,
    });
    return { history, followUp: buildFollowUpSummary(history) };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listPatientTimeline",
      requestId,
    });
    throw error;
  }
}
