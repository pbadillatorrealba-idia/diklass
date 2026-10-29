import type { SupabaseClient } from "@supabase/supabase-js";
import { parseRows } from "@/features/registro/read-rows";
import {
  type ConsultationSummaryContent,
  consultationSummaryContentSchema,
} from "@/features/registro/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
import { createClinicalRecord } from "@/lib/attribution/clinical-mutations";
import type { ClinicalMutationResult } from "@/lib/attribution/types";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Resumen de la consulta (memoria del agente · migración 025). Historial de solo agregar: guardar un
 * resumen nuevo es otra fila y el vigente es el más reciente. El autor y el momento los fija el servidor.
 */
export async function latestConsultationSummary(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<ConsultationSummaryContent | null> {
  const { data, error } = await client
    .from("clinical_records")
    .select("*")
    .eq("record_type", "consultation_summary")
    .eq("content->>consultationId", consultationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (
    parseRows(data, consultationSummaryContentSchema, "latestConsultationSummary")[0]?.content ??
    null
  );
}

export async function recordConsultationSummary(
  client: SupabaseClient<Database>,
  input: { clinicId: string; consultationId: string; text: string },
): Promise<ClinicalMutationResult<ClinicalRecordRow>> {
  const content = consultationSummaryContentSchema.parse({
    consultationId: input.consultationId,
    text: input.text,
  });
  return createClinicalRecord(client, {
    clinic_id: input.clinicId,
    record_type: "consultation_summary",
    content,
    status: "draft",
  });
}
