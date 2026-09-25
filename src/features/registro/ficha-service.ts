import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { parseRows } from "@/features/registro/read-rows";
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
import {
  ClinicalWriteConflictError,
  createClinicalRecord,
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
 * Puerta de escritura de las fichas de paciente (FR-001, FR-044, D6 del diseño del cambio).
 *
 * - El alta resuelve el tutor: o lo crea (`newTutor`) o asocia el existente (`existingTutorId`)
 *   sin duplicarlo (FR-027 · US1-AC4); la ficha guarda solo el `tutorId`.
 * - La ampliación con `addAntecedentItem` apénda sin tocar los ítems previos ni los demás
 *   campos (FR-001 · US1-AC2); un ítem `negative: true` es un hallazgo negativo registrado y
 *   una lista vacía sigue siendo «sin dato» (FR-044 · SC-024).
 * - Las dos escrituras sobre una ficha existente releen la fila y la actualizan solo si nadie la
 *   editó entretanto (`writePatientContent`): dos veterinarios de la clínica editan la misma
 *   ficha (T055) y ninguno debe pisar lo que el otro añadió.
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

const fichaEditableSchema = patientContentSchema.omit({ tutorId: true, antecedentes: true });

/** Intentos de relectura ante una edición concurrente antes de rendirse con el conflicto. */
const MAX_WRITE_ATTEMPTS = 3;

/**
 * Relee la ficha, construye el contenido nuevo sobre esa lectura y lo escribe solo si la fila
 * no cambió desde entonces. Ante un conflicto vuelve a leer y a construir, así que `build`
 * debe partir siempre de `actual` y nunca de una lectura previa de quien llama.
 */
async function writePatientContent(
  client: SupabaseClient<Database>,
  patientId: string,
  build: (actual: PatientContent) => PatientContent,
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  for (let attempt = 1; ; attempt += 1) {
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
    const content = patientContentSchema.parse(build(patientContentSchema.parse(data.content)));
    try {
      return await updateClinicalContent(client, patientId, content, {
        expectedUpdatedAt: data.updated_at,
      });
    } catch (error) {
      if (!(error instanceof ClinicalWriteConflictError) || attempt >= MAX_WRITE_ATTEMPTS) {
        throw error;
      }
    }
  }
}

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

/**
 * Actualiza los datos de la ficha. Los antecedentes y el tutor no viajan en esta escritura:
 * se conservan los de la fila recién leída. Los antecedentes crecen solo con
 * `addAntecedentItem`, y tomarlos de la lectura de quien llama borraría los que otro
 * veterinario añadió mientras editaba (revisión de la PR #27).
 */
export async function updatePatientFicha(
  client: SupabaseClient<Database>,
  patientId: string,
  ficha: Omit<PatientContent, "tutorId" | "antecedentes">,
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const fichaValidada = fichaEditableSchema.parse(ficha);
    const actualizada = await writePatientContent(client, patientId, (actual) => ({
      ...fichaValidada,
      antecedentes: actual.antecedentes,
      tutorId: actual.tutorId,
    }));
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

    // Apéndice sobre un solo grupo: los ítems previos y los demás campos quedan intactos.
    const grupo = grupoParseado.data;
    const actualizada = await writePatientContent(client, patientId, (actual) => ({
      ...actual,
      antecedentes: { ...actual.antecedentes, [grupo]: [...actual.antecedentes[grupo], item] },
    }));
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
    return parseRows(data, patientContentSchema, "listPatients");
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listPatients",
      requestId,
    });
    throw error;
  }
}
