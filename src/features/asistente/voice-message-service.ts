import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { TranscribeClient } from "@/features/voz/remote-transcription-adapter";
import type { AudioPayload } from "@/features/voz/transcription-port";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Audio de los mensajes del chat (asistente-conversacional «Grabar, revisar y enviar audio» ·
 * design.md D5 · tarea 7.5): subir a Storage, transcribir con la Edge Function y borrar. El audio se
 * sube ANTES de insertar el mensaje (se transcribe y entonces se persiste una vez).
 */
export const CHAT_AUDIO_BUCKET = "assistant-audio";

/** Ruta canónica que exige la migración 023: `{clinic}/{author}/{message}.{webm|m4a}`. */
export const rutaAudioChat = (
  clinicId: string,
  authorId: string,
  messageId: string,
  extension: AudioPayload["extension"],
) => `${clinicId}/${authorId}/${messageId}.${extension}`;

export async function subirAudioChat(
  client: SupabaseClient<Database>,
  path: string,
  audio: AudioPayload,
): Promise<void> {
  // ArrayBuffer (no Blob): storage-js sube vacío un Blob en React Native.
  const { error } = await client.storage
    .from(CHAT_AUDIO_BUCKET)
    .upload(path, audio.data, { contentType: audio.mimeType, upsert: false });
  if (error) {
    throw new Error(`No se pudo conservar el audio del mensaje: ${error.message}`);
  }
}

/**
 * Borra objetos de audio. De mejor esfuerzo: si falla, el mensaje ya no apunta al objeto y la purga
 * programada barre lo que quede sin referencia, así que un fallo no debe tumbar la acción del usuario.
 */
export async function borrarAudioChat(
  client: SupabaseClient<Database>,
  paths: readonly string[],
): Promise<void> {
  if (paths.length === 0) return;
  try {
    await client.storage.from(CHAT_AUDIO_BUCKET).remove([...paths]);
  } catch {
    // Lo recoge la purga.
  }
}

/** 2 min de audio con el proveedor (60 s en la función) más la red: el cliente espera algo más. */
export const TRANSCRIBE_CHAT_TIMEOUT_MS = 75_000;

/**
 * La parte `audio` del multipart. Web: un `File`. React Native: su `FormData` solo tiene `append` y
 * sube partes `{ uri, name, type }`, no `Blob`.
 */
function parteDeAudio(audio: AudioPayload): File | { uri: string; name: string; type: string } {
  const name = `mensaje.${audio.extension}`;
  return audio.uri
    ? { uri: audio.uri, name, type: audio.mimeType }
    : new File([audio.data], name, { type: audio.mimeType });
}

const respuestaSchema = z.object({
  text: z.string(),
  quality: z.enum(["ok", "insufficient"]),
});

type FunctionError = { message: string; context?: { json: () => Promise<unknown> } };

async function motivo(error: FunctionError): Promise<string> {
  try {
    const cuerpo = (await error.context?.json()) as { code?: string } | undefined;
    if (cuerpo?.code) return cuerpo.code;
  } catch {
    // Sin cuerpo legible: vale el mensaje del cliente.
  }
  return error.message;
}

/** Transcribe con `transcribe-chat-audio` (sin sesión de escucha); todo fallo se propaga con su motivo. */
export async function transcribirAudioChat(
  client: TranscribeClient,
  audio: AudioPayload,
): Promise<{ text: string; quality: "ok" | "insufficient" }> {
  const body = new FormData();
  // `append`, no `set`: el FormData de React Native no tiene `set`.
  body.append("audio", parteDeAudio(audio) as unknown as Blob);
  const { data, error } = await client.functions.invoke("transcribe-chat-audio", {
    body,
    timeout: TRANSCRIBE_CHAT_TIMEOUT_MS,
  });
  if (error) {
    throw new Error(`No se pudo transcribir el audio: ${await motivo(error)}`);
  }
  return respuestaSchema.parse(data);
}

/** URL de corta vida para reproducir un audio vigente; `null` si ya venció o no es del autor. */
export async function firmarAudioChat(
  client: SupabaseClient<Database>,
  path: string,
): Promise<string | null> {
  const { data, error } = await client.storage.from(CHAT_AUDIO_BUCKET).createSignedUrl(path, 60);
  return error ? null : (data?.signedUrl ?? null);
}

/**
 * «Eliminar audio»: la RPC marca el mensaje (la transcripción permanece) y devuelve la ruta; el cliente
 * borra el objeto porque Storage no se borra por SQL. Devuelve si había audio que quitar.
 */
export async function quitarAudio(
  client: SupabaseClient<Database>,
  messageId: string,
): Promise<boolean> {
  const { data, error } = await client.rpc("remove_assistant_audio", { p_message_id: messageId });
  if (error) throw new Error(error.message);
  if (!data) return false;
  await borrarAudioChat(client, [data]);
  return true;
}

/** Rutas de audio de la conversación del autor (la RLS acota a sus filas), para borrarlas con ella. */
export async function rutasDeAudio(client: SupabaseClient<Database>): Promise<string[]> {
  const { data, error } = await client
    .from("assistant_messages")
    .select("audio_path")
    .not("audio_path", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).flatMap((fila) => (fila.audio_path ? [fila.audio_path] : []));
}
