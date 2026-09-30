import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRows, readAllPages } from "@/features/registro/read-rows";
import { type TutorContent, tutorContentSchema } from "@/features/registro/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
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
 * Alta, actualización y listado de tutores (FR-027, D6 del diseño del cambio).
 *
 * El tutor es una fila `clinical_records` de tipo `tutor`; la ficha del paciente lo referencia
 * por `tutorId` para no duplicarlo (US1-AC4). Toda escritura cruza el contrato de atribución
 * (D9) y valida el contenido con Zod en esta frontera (Constitución V). Los errores del servidor
 * viajan sin envolver: la UI decide con `isAuthenticationRequired` si abre el diálogo de sesión
 * expirada. Cada operación lleva su `requestId` en los logs (Constitución IV).
 */

/** Tutor leído desde la traza clínica: fila cruda y contenido ya validado. */
export type TutorEntry = { record: ClinicalRecordRow; content: TutorContent };

export async function createTutor(
  client: SupabaseClient<Database>,
  input: { clinicId: string; tutor: TutorContent },
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const content = tutorContentSchema.parse(input.tutor);
    const creado = await createClinicalRecord(client, {
      clinic_id: input.clinicId,
      record_type: "tutor",
      content,
      status: "draft",
    });
    logEvent("registro.tutor_created", { requestId, operation: "createTutor" });
    return creado;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "createTutor",
      requestId,
    });
    throw error;
  }
}

export async function updateTutor(
  client: SupabaseClient<Database>,
  tutorId: string,
  tutor: TutorContent,
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const content = tutorContentSchema.parse(tutor);
    const actualizado = await updateClinicalContent(client, tutorId, content);
    logEvent("registro.tutor_updated", { requestId, operation: "updateTutor" });
    return actualizado;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "updateTutor",
      requestId,
    });
    throw error;
  }
}

export async function listTutors(client: SupabaseClient<Database>): Promise<TutorEntry[]> {
  const requestId = makeRequestId();
  try {
    const data = await readAllPages((from, to) =>
      client
        .from("clinical_records")
        .select("*")
        .eq("record_type", "tutor")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    );
    return parseRows(data, tutorContentSchema, "listTutors");
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listTutors",
      requestId,
    });
    throw error;
  }
}

/**
 * Un tutor por id (sistema-visual D20: encabezado de la consulta), sin cargar todos los de la
 * clínica. Misma frontera tolerante que `listTutors`: un id inexistente o una fila ilegible
 * resuelven `null`, con log estructurado en el segundo caso.
 */
export async function getTutor(
  client: SupabaseClient<Database>,
  tutorId: string,
): Promise<TutorEntry | null> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", tutorId)
      .eq("record_type", "tutor")
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ? (parseRows([data], tutorContentSchema, "getTutor")[0] ?? null) : null;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "getTutor",
      requestId,
    });
    throw error;
  }
}
