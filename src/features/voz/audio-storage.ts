import type { SupabaseClient } from "@supabase/supabase-js";
import type { AudioPayload } from "@/features/voz/transcription-port";
import type { Database } from "@/lib/supabase/database.types";

/** Bucket privado de la migración 019: el audio es dato clínico, acotado por clínica con RLS. */
export const AUDIO_BUCKET = "consultation-audio";

/** Ruta canónica del audio de un tramo: la que exige `guard_transcript_segment` (019). */
export const rutaAudio = (
  clinicId: string,
  listenSessionId: string,
  seq: number,
  extension: AudioPayload["extension"],
) => `${clinicId}/${listenSessionId}/${seq}.${extension}`;

/**
 * Conserva el audio de un tramo ya aceptado (D4): la política de Storage exige que exista un
 * tramo con esa ruta, así que se sube DESPUÉS de guardar el tramo y nunca sobrescribe.
 */
export async function subirAudio(
  client: SupabaseClient<Database>,
  path: string,
  audio: AudioPayload,
): Promise<void> {
  const { error } = await client.storage
    .from(AUDIO_BUCKET)
    .upload(path, audio.blob, { contentType: audio.mimeType, upsert: false });
  if (error) {
    throw new Error(`No se pudo conservar el audio del tramo: ${error.message}`);
  }
}
