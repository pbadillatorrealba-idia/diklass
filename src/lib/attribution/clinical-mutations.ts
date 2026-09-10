import type { SupabaseClient } from "@supabase/supabase-js";
import { assertNoClientAttributionFields } from "@/lib/attribution/guards";
import type { ClinicalMutationResult } from "@/lib/attribution/types";
import type { Database } from "@/lib/supabase/database.types";

type ClinicalRecord = Database["public"]["Tables"]["clinical_records"]["Row"];

export async function createClinicalRecord(
  client: SupabaseClient<Database>,
  payload: Record<string, unknown>,
): Promise<ClinicalMutationResult<ClinicalRecord>> {
  assertNoClientAttributionFields(payload);
  const { data, error } = await client
    .from("clinical_records")
    .insert(payload as never)
    .select("*")
    .single();
  if (error || !data) {
    throw error ?? new Error("No se pudo crear el registro clínico.");
  }

  return {
    record: data,
    attribution: {
      actorId: data.created_by,
      occurredAt: data.created_at,
      action:
        data.status === "corrective" ? "corrective_record_created" : "clinical_record_created",
      supersedesEventId: data.supersedes_event_id,
    },
  };
}
