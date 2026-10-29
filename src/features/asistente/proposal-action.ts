import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod";
import { isLegacyAnamnesisField } from "@/features/registro/anamnesis-catalog";
import { listAnamnesisEntries, recordAnamnesisEntry } from "@/features/registro/anamnesis-service";
import { type AnamnesisField, anamnesisContentSchema } from "@/features/registro/schema";
import type { Attribution } from "@/lib/attribution/types";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Acción que una propuesta del agente ejecuta al confirmarse. Es la única vía de escritura del agente:
 * pasa por el mismo servicio y la misma validación que la UI manual, con procedencia «inferida» y la
 * atribución que fija el servidor (FR-063).
 */
export const proposalActionSchema = z.object({
  kind: z.literal("anamnesis"),
  consultationId: z.string().min(1),
  field: z.string().min(1),
  text: z.string().min(1),
});

export type ProposalAction = z.infer<typeof proposalActionSchema>;

/** ¿La acción es válida contra el catálogo vigente? Lo que no lo es se descarta antes de mostrarse. */
export const isValidAction = (action: ProposalAction) =>
  !isLegacyAnamnesisField(action.field) &&
  anamnesisContentSchema.safeParse({ ...action, provenance: "inferida" }).success;

/**
 * Ejecuta la acción. Idempotente por contenido: si la consulta ya tiene esa entrada exacta (p. ej. se
 * confirmó y se recargó la conversación), no duplica y devuelve `null` en vez de atribución.
 */
// ponytail: comprobar-y-luego-insertar; dos pestañas pueden duplicar. Clave de idempotencia en servidor si importa.
export async function executeProposal(
  client: SupabaseClient<Database>,
  clinicId: string,
  action: ProposalAction,
): Promise<{ attribution: Attribution | null }> {
  const existentes = await listAnamnesisEntries(client, action.consultationId);
  if (existentes.some((e) => e.content.field === action.field && e.content.text === action.text)) {
    return { attribution: null };
  }
  const { attribution } = await recordAnamnesisEntry(client, {
    clinicId,
    consultationId: action.consultationId,
    field: action.field as AnamnesisField,
    text: action.text,
    provenance: "inferida",
  });
  return { attribution };
}
