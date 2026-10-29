/**
 * Lo común de las funciones que transcriben audio (`transcribe-audio` y `transcribe-chat-audio`): el
 * mismo proveedor, los mismos contenedores aceptados y la misma regla de calidad. Sin Deno ni red
 * propia: `fetch` y el tiempo máximo entran por parámetro, así que se prueba con unitarias.
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const satisfies Record<string, string>;

// `video/webm`: el mismo contenedor WebM de solo audio; algunos runtimes y navegadores lo
// reetiquetan así al armar el FormData.
export const MIME_PERMITIDOS = new Set([
  "audio/webm",
  "video/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
]);

/** Vocabulario que orienta al reconocedor: etología clínica y fármacos habituales (no es una instrucción). */
export const GLOSARIO_ASR =
  "Consulta veterinaria de etología canina: ansiedad por separación, reactividad, fobia a ruidos, estereotipias, desensibilización, fluoxetina, clomipramina, trazodona, gabapentina, selegilina, meloxicam.";

export const MODELO_TRANSCRIPCION = "gpt-transcribe";

/** El proveedor excedió el tiempo máximo (FR-055): el cliente descarta el audio. */
export class TranscriptionTimeoutError extends Error {
  constructor() {
    super("TRANSCRIPTION_TIMEOUT");
    this.name = "TranscriptionTimeoutError";
  }
}

/** FR-031: calidad por la cantidad de letras; vacío, ruido o puntuación no es clínicamente útil. */
export function calidad(texto: string): "ok" | "insufficient" {
  const letras = texto.match(/\p{L}/gu)?.length ?? 0;
  return letras < 3 ? "insufficient" : "ok";
}

/** Tipo base de un `Blob` sin parámetros (`audio/webm;codecs=opus` → `audio/webm`). */
export const tipoBase = (audio: Blob) => audio.type.split(";")[0]?.trim() ?? "";

/**
 * Transcribe con OpenAI (`gpt-transcribe`, español). La credencial viaja solo aquí y nunca se
 * registra ni se devuelve; ante un error de proveedor solo se propaga el estado, no su cuerpo.
 */
export async function transcribeWithOpenAI(options: {
  audio: Blob;
  apiKey: string;
  timeoutMs: number;
  fetcher?: typeof fetch;
}): Promise<string> {
  const { audio, apiKey, timeoutMs, fetcher = fetch } = options;
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
  const form = new FormData();
  form.set("file", audio, audio.type.includes("webm") ? "audio.webm" : "audio.m4a");
  form.set("model", MODELO_TRANSCRIPCION);
  form.set("language", "es");
  form.set("prompt", GLOSARIO_ASR);
  form.set("response_format", "json");
  let respuesta: Response;
  try {
    respuesta = await fetcher("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new TranscriptionTimeoutError();
    }
    throw error;
  }
  if (!respuesta.ok) {
    // Solo el estado: el cuerpo del proveedor no se propaga ni se registra.
    throw new Error(`OPENAI_${respuesta.status}`);
  }
  const { text } = (await respuesta.json()) as { text?: string };
  return text ?? "";
}
