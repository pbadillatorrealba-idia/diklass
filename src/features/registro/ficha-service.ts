import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  type AntecedentGroup,
  type AntecedentItem,
  type PatientContent,
  patientContentSchema,
  type TutorContent,
  tutorContentSchema,
} from "@/features/registro/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
import { createTutor } from "@/features/registro/tutor-service";
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
 * Puerta de escritura de las fichas de paciente (FR-001, FR-044, D6 del diseño del cambio).
 *
 * - El alta resuelve el tutor: o lo crea (`newTutor`) o asocia el existente (`existingTutorId`)
 *   sin duplicarlo (FR-027 · US1-AC4); la ficha guarda solo el `tutorId`.
 * - La ampliación con `addAntecedentItem` apénda sin tocar los ítems previos ni los demás
 *   campos (FR-001 · US1-AC2); un ítem `negative: true` es un hallazgo negativo registrado y
 *   una lista vacía sigue siendo «sin dato» (FR-044 · SC-024).
 * - Todo se valida con Zod en esta frontera antes de tocar el servidor y toda escritura cruza
 *   el contrato de atribución (D9). Los errores viajan sin envolver para que la UI decida con
 *   `isAuthenticationRequired`, y cada operación lleva su `requestId` (Constitución IV).
 */

/** Ficha leída desde la traza clínica: fila cruda y contenido ya validado. */
export type PatientEntry = { record: ClinicalRecordRow; content: PatientContent };

/**
 * `schema.ts` exporta el tipo del grupo de antecedentes, no su representación en tiempo de
 * ejecución; este enum la aporta para validar el grupo del apéndice antes de construir nada.
 */
const antecedentGroupSchema = z.enum([
  "medicalHistory",
  "preexistingDiseases",
  "currentMedications",
  "knownAllergies",
  "behavioralHistory",
]);

const existingTutorIdSchema = z.string().trim().min(1, "Identifica al tutor del paciente.");

const fichaSinTutorSchema = patientContentSchema.omit({ tutorId: true });

export async function createPatientFicha(
  client: SupabaseClient<Database>,
  input: {
    clinicId: string;
    ficha: Omit<PatientContent, "tutorId">;
    tutor: { existingTutorId: string } | { newTutor: TutorContent };
  },
): Promise<ClinicalMutationResult<ClinicalRecordRow> & { tutorId: string }> {
  const requestId = makeRequestId();
  try {
    // Se valida todo antes de la primera escritura: una ficha inválida no deja un tutor huérfano.
    const fichaValidada = fichaSinTutorSchema.parse(input.ficha);
    let tutorId: string;
    if ("newTutor" in input.tutor) {
      const tutorCreado = await createTutor(client, {
        clinicId: input.clinicId,
        tutor: tutorContentSchema.parse(input.tutor.newTutor),
      });
      tutorId = tutorCreado.record.id;
    } else {
      tutorId = existingTutorIdSchema.parse(input.tutor.existingTutorId);
    }

    const alta = await createClinicalRecord(client, {
      clinic_id: input.clinicId,
      record_type: "patient",
      content: { ...fichaValidada, tutorId },
      status: "draft",
    });
    logEvent("registro.patient_created", { requestId, operation: "createPatientFicha" });
    return { ...alta, tutorId };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "createPatientFicha",
      requestId,
    });
    throw error;
  }
}

export async function updatePatientFicha(
  client: SupabaseClient<Database>,
  patientId: string,
  ficha: Omit<PatientContent, "tutorId">,
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const fichaValidada = fichaSinTutorSchema.parse(ficha);
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", patientId)
      .eq("record_type", "patient")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error("No se encontró la ficha del paciente.");
    }

    // El tutor no viaja en la actualización: se conserva el que ya vincula la ficha (D6).
    const actual = patientContentSchema.parse(data.content);
    const actualizada = await updateClinicalContent(client, patientId, {
      ...fichaValidada,
      tutorId: actual.tutorId,
    });
    logEvent("registro.patient_updated", { requestId, operation: "updatePatientFicha" });
    return actualizada;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "updatePatientFicha",
      requestId,
    });
    throw error;
  }
}

export async function addAntecedentItem(
  client: SupabaseClient<Database>,
  patientId: string,
  group: AntecedentGroup,
  item: AntecedentItem,
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const grupoParseado = antecedentGroupSchema.safeParse(group);
    if (!grupoParseado.success) {
      throw new Error(`Grupo de antecedentes desconocido: ${String(group)}`);
    }

    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", patientId)
      .eq("record_type", "patient")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error("No se encontró la ficha del paciente.");
    }

    // Apéndice sobre un solo grupo: los ítems previos y los demás campos quedan intactos.
    const actual = patientContentSchema.parse(data.content);
    const antecedentes = {
      ...actual.antecedentes,
      [grupoParseado.data]: [...actual.antecedentes[grupoParseado.data], item],
    };
    const content = patientContentSchema.parse({ ...actual, antecedentes });
    const actualizada = await updateClinicalContent(client, patientId, content);
    logEvent("registro.patient_antecedent_added", { requestId, operation: "addAntecedentItem" });
    return actualizada;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "addAntecedentItem",
      requestId,
    });
    throw error;
  }
}

export async function getPatient(
  client: SupabaseClient<Database>,
  patientId: string,
): Promise<PatientEntry | null> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", patientId)
      .eq("record_type", "patient")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    // Frontera de lectura tolerante: una fila malformada ajena al contrato se omite con log
    // estructurado (la escritura sigue siendo estricta). Una ficha ilegible resuelve `null`.
    const legible = patientContentSchema.safeParse(data.content);
    if (!legible.success) {
      logEvent(
        "registro.row_content_skipped",
        { operation: "getPatient", recordId: patientId, errorName: "ZodError" },
        "error",
      );
      return null;
    }
    return { record: data, content: legible.data };
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "getPatient",
      requestId,
    });
    throw error;
  }
}

export async function listPatients(client: SupabaseClient<Database>): Promise<PatientEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "patient")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).flatMap((row) => {
      const legible = patientContentSchema.safeParse(row.content);
      if (!legible.success) {
        logEvent(
          "registro.row_content_skipped",
          { operation: "listPatients", recordId: row.id, errorName: "ZodError" },
          "error",
        );
        return [];
      }
      return [{ record: row, content: legible.data }];
    });
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listPatients",
      requestId,
    });
    throw error;
  }
}
