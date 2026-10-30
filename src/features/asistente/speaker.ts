import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod";
import type { AudioPlayback } from "@/features/asistente/audio-playback";
import { createAudioPlayback } from "@/features/asistente/audio-playback";
import { type Message, messageText, type Part } from "@/features/asistente/chat-model";

/**
 * Voz de la respuesta del asistente: texto → Edge Function `speak` → audio. Una sola locución a la vez;
 * `stopSpeaking` la corta (el usuario habla, envía o pulsa «Detener»). Es mejor esfuerzo: un fallo de
 * la voz nunca rompe la respuesta escrita.
 */
const respuestaSchema = z.object({ audio: z.string(), mime: z.string() });

/** Tope que acepta la función; lo que excede se recorta al último espacio. */
export const MAX_SPOKEN_CHARS = 1500;

/** Texto que se locuta de una respuesta: solo texto y avisos, sin tarjetas ni citas. */
export function spokenText(parts: readonly Part[]): string {
  const texto = messageText({ parts: parts.filter((p) => p.type === "text") } as Message);
  if (texto.length <= MAX_SPOKEN_CHARS) return texto;
  const corte = texto.lastIndexOf(" ", MAX_SPOKEN_CHARS);
  return texto.slice(0, corte > 0 ? corte : MAX_SPOKEN_CHARS);
}

let actual: AudioPlayback | null = null;
// Cada orden de hablar o callar invalida las anteriores, aunque su audio aún esté en camino.
let generacion = 0;

export function stopSpeaking() {
  generacion++;
  actual?.dispose();
  actual = null;
}

export async function speak(client: Pick<SupabaseClient, "functions">, text: string) {
  stopSpeaking();
  const mia = generacion;
  const { data, error } = await client.functions.invoke("speak", { body: { text } });
  if (error) throw error;
  const { audio, mime } = respuestaSchema.parse(data);
  // El usuario pudo callar o pedir otra cosa mientras llegaba el audio.
  if (mia !== generacion) return;
  const reproductor = createAudioPlayback({ url: `data:${mime};base64,${audio}` });
  actual = reproductor;
  reproductor.onEnded(() => {
    if (actual === reproductor) {
      reproductor.dispose();
      actual = null;
    }
  });
  reproductor.play();
}
