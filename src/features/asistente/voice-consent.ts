import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Consentimiento de la primera grabación (asistente-conversacional «Grabar, revisar y enviar audio»):
 * el audio y su transcripción se envían a un proveedor externo (OpenAI) para transcribirse, así que el
 * veterinario lo acepta antes de poder grabar. Una fila por autor (`assistant_voice_consent`); el
 * cliente solo declara la versión del aviso: el autor y el momento los fija el servidor. Si el aviso
 * cambia, se sube la versión y se vuelve a pedir.
 */
export const VOICE_CONSENT_VERSION = "v1";

export async function hasVoiceConsent(client: SupabaseClient<Database>): Promise<boolean> {
  const { data, error } = await client
    .from("assistant_voice_consent")
    .select("version")
    .eq("version", VOICE_CONSENT_VERSION);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function acceptVoiceConsent(client: SupabaseClient<Database>): Promise<void> {
  const { error } = await client
    .from("assistant_voice_consent")
    .insert({ version: VOICE_CONSENT_VERSION });
  if (error) throw new Error(error.message);
}
