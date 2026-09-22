import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AnamnesisContent,
  type AnamnesisField,
  anamnesisContentSchema,
  type Provenance,
} from "@/features/registro/schema";
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
 * Antecedentes de anamnesis de una consulta (FR-004, FR-021 · US2).
 *
 * Cada entrada registra campo, texto y procedencia del vocabulario canónico de FR-021; un
 * campo sin registrar sigue siendo «sin dato» y nunca un hallazgo negativo (SC-024). La
 * corrección de procedencia (US2-AC5) actualiza `content.provenance` y apénda la anterior en
 * `content.provenanceHistory`: la corrección es recuperable dentro de la fila y el trigger de
 * auditoría emite `anamnesis_corrected` con autor y momento
 * (D7 del diseño del cambio). Los errores viajan sin envolver (`isAuthenticationRequired`) y
 * cada operación lleva su `requestId` (Constitución IV).
 */

/** Entrada de anamnesis leída desde la traza clínica: fila cruda y contenido validado. */
export type AnamnesisEntry = { record: ClinicalRecordRow; content: AnamnesisContent };

export async function recordAnamnesisEntry(
  client: SupabaseClient<Database>,
  input: {
    clinicId: string;
    consultationId: string;
    field: AnamnesisField;
    text: string;
    provenance: Provenance;
  },
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const content = anamnesisContentSchema.parse({
      consultationId: input.consultationId,
      field: input.field,
      text: input.text,
      provenance: input.provenance,
    });
    const registrada = await createClinicalRecord(client, {
      clinic_id: input.clinicId,
      record_type: "anamnesis",
      content,
      status: "draft",
    });
    logEvent("registro.anamnesis_recorded", { requestId, operation: "recordAnamnesisEntry" });
    return registrada;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "recordAnamnesisEntry",
      requestId,
    });
    throw error;
  }
}

export async function listAnamnesisEntries(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<AnamnesisEntry[]> {
  const requestId = makeRequestId();
  try {
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("record_type", "anamnesis")
      .eq("content->>consultationId", consultationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      throw error;
    }
    return (data ?? []).flatMap((row) => {
      const legible = anamnesisContentSchema.safeParse(row.content);
      if (!legible.success) {
        logEvent(
          "registro.row_content_skipped",
          { operation: "listAnamnesisEntries", recordId: row.id, errorName: "ZodError" },
          "error",
        );
        return [];
      }
      return [{ record: row, content: legible.data }];
    });
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "listAnamnesisEntries",
      requestId,
    });
    throw error;
  }
}

export async function correctProvenance(
  client: SupabaseClient<Database>,
  entryId: string,
  provenance: Provenance,
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const requestId = makeRequestId();
  try {
    const nuevaProvenance = anamnesisContentSchema.shape.provenance.parse(provenance);
    const { data, error } = await client
      .from("clinical_records")
      .select("*")
      .eq("id", entryId)
      .eq("record_type", "anamnesis")
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error("No se encontró el registro de anamnesis.");
    }

    // D7: la corrección es recuperable — la procedencia anterior se apéndice en la historia.
    const actual = anamnesisContentSchema.parse(data.content);
    const content = anamnesisContentSchema.parse({
      ...actual,
      provenance: nuevaProvenance,
      provenanceHistory: [...(actual.provenanceHistory ?? []), { provenance: actual.provenance }],
    });
    const corregida = await updateClinicalContent(client, entryId, content);
    logEvent("registro.anamnesis_corrected", { requestId, operation: "correctProvenance" });
    return corregida;
  } catch (error) {
    void captureClientError(client as unknown as ErrorReporterClient, {
      error,
      operation: "correctProvenance",
      requestId,
    });
    throw error;
  }
}
