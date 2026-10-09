import type { SupabaseClient } from "@supabase/supabase-js";
import { displayNameSchema } from "@/features/perfil/schema";
import type { Database } from "@/lib/supabase/database.types";

export type ProfileChange = {
  id: string;
  occurredAt: string;
  previous: string;
  current: string;
};

/** Cambia el propio nombre visible; el servidor lo valida, lo audita y exige sesión activa. */
export async function updateOwnProfile(
  client: SupabaseClient<Database>,
  displayName: string,
): Promise<{ displayName: string }> {
  const { data, error } = await client.rpc("update_own_profile", {
    p_display_name: displayNameSchema.parse(displayName),
  });
  if (error) throw error;
  return { displayName: data.display_name };
}

/** Historial «Cambios de nombre» del propio profesional, el más reciente primero. */
export async function listProfileChanges(
  client: SupabaseClient<Database>,
  veterinarianId: string,
): Promise<ProfileChange[]> {
  const { data, error } = await client
    .from("clinical_audit_events")
    .select("id, occurred_at, metadata")
    .eq("entity_type", "veterinarian")
    .eq("entity_id", veterinarianId)
    .eq("action", "veterinarian_profile_updated")
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => {
    const metadata = row.metadata as { previous?: string; current?: string };
    return {
      id: row.id,
      occurredAt: row.occurred_at,
      previous: metadata.previous ?? "",
      current: metadata.current ?? "",
    };
  });
}
