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

  // The action comes from the audit event the trigger wrote, so the response names
  // the enumerated FR-063 action instead of a client-side guess.
  const { data: event, error: eventError } = await client
    .from("clinical_audit_events")
    .select("action, actor_id, occurred_at, supersedes_event_id")
    .eq("entity_id", data.id)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eventError) {
    throw eventError;
  }

  return {
    record: data,
    attribution: event
      ? {
          actorId: event.actor_id,
          occurredAt: event.occurred_at,
          action: event.action,
          supersedesEventId: event.supersedes_event_id,
        }
      : {
          actorId: data.created_by,
          occurredAt: data.created_at,
          action: null,
          supersedesEventId: data.supersedes_event_id,
        },
  };
}
