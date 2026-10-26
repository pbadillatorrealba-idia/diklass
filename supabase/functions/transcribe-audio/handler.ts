import { z } from "zod";

/**
 * Transcripción de un tramo de la escucha clínica (cambio implementar-asr-real-captura-voz, D3).
 * Handler puro con dependencias inyectadas (patrón de report-client-error): sin Deno ni red, así
 * que se prueba con unitarias. Nunca registra audio, texto transcrito ni la credencial: el texto
 * es dato clínico (Principio V) y la bitácora lleva solo identificadores, estado y tamaños.
 */

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const satisfies Record<string, string>;

/** Coincide con el límite del bucket `consultation-audio` (migración 019). */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const MARGEN_MULTIPART_BYTES = 64 * 1024;

// `video/webm`: el mismo contenedor WebM de solo audio; algunos runtimes y navegadores lo
// reetiquetan así al armar el FormData.
const MIME_PERMITIDOS = new Set([
  "audio/webm",
  "video/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
]);

const sessionIdSchema = z.string().uuid();

/** El proveedor excedió el tiempo máximo (FR-055): el cliente descarta el tramo. */
export class TranscriptionTimeoutError extends Error {
  constructor() {
    super("TRANSCRIPTION_TIMEOUT");
    this.name = "TranscriptionTimeoutError";
  }
}

export type TranscribeDependencies = {
  log: (line: string) => void;
  randomId: () => string;
  /** FR-014: la sesión existe, es de la clínica del solicitante, está activa y su consulta abierta. */
  canTranscribe: (authorization: string, listeningSessionId: string) => Promise<boolean>;
  /** Devuelve el texto transcrito; lanza TranscriptionTimeoutError al exceder el tiempo máximo. */
  transcribe: (audio: Blob) => Promise<string>;
};

const respond = (body: Record<string, unknown>, status: number) =>
  Response.json(body, { status, headers: corsHeaders });

/** FR-031: calidad por la cantidad de letras; vacío, ruido o puntuación no es clínicamente útil. */
function calidad(texto: string): "ok" | "insufficient" {
  const letras = texto.match(/\p{L}/gu)?.length ?? 0;
  return letras < 3 ? "insufficient" : "ok";
}

export async function handleTranscribeAudio(
  request: Request,
  deps: TranscribeDependencies,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const requestId = deps.randomId();
  const fallo = (code: string, status: number) => {
    deps.log(
      JSON.stringify({
        event: "transcribe_audio_rejected",
        requestId,
        code,
        status,
        timestamp: new Date().toISOString(),
      }),
    );
    return respond({ code, requestId }, status);
  };

  if (request.method !== "POST") {
    return fallo("METHOD_NOT_ALLOWED", 405);
  }
  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return fallo("UNAUTHENTICATED", 401);
  }

  // Antes de parsear: `formData()` bufferiza el cuerpo entero, así que un multipart enorme se
  // rechaza por la cabecera declarada (el margen cubre los campos y los límites del multipart).
  const declarado = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declarado) && declarado > MAX_AUDIO_BYTES + MARGEN_MULTIPART_BYTES) {
    return fallo("PAYLOAD_TOO_LARGE", 413);
  }

  let form: globalThis.FormData;
  try {
    form = (await request.formData()) as unknown as globalThis.FormData;
  } catch {
    return fallo("INVALID_INPUT", 400);
  }
  const audio = form.get("audio");
  const sessionId = sessionIdSchema.safeParse(form.get("listeningSessionId"));
  if (!(audio instanceof Blob) || !sessionId.success) {
    return fallo("INVALID_INPUT", 400);
  }
  if (!MIME_PERMITIDOS.has(audio.type.split(";")[0]?.trim() ?? "")) {
    return fallo("INVALID_INPUT", 400);
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return fallo("PAYLOAD_TOO_LARGE", 413);
  }

  // Fallo cerrado (FR-014): ante cualquier error al comprobar, no se envía audio al proveedor.
  let permitido = false;
  try {
    permitido = await deps.canTranscribe(authorization, sessionId.data);
  } catch {
    permitido = false;
  }
  if (!permitido) {
    return fallo("FORBIDDEN", 403);
  }

  const inicio = Date.now();
  try {
    const text = (await deps.transcribe(audio)).trim();
    const quality = calidad(text);
    deps.log(
      JSON.stringify({
        event: "transcribe_audio_done",
        requestId,
        quality,
        audioBytes: audio.size,
        durationMs: Date.now() - inicio,
        timestamp: new Date().toISOString(),
      }),
    );
    return respond({ text, quality, requestId }, 200);
  } catch (error) {
    // Solo el nombre de la clase: el mensaje del proveedor podría arrastrar la credencial.
    deps.log(
      JSON.stringify({
        event: "transcribe_audio_failed",
        requestId,
        error: { name: error instanceof Error ? error.name : "Error" },
        durationMs: Date.now() - inicio,
        timestamp: new Date().toISOString(),
      }),
    );
    return respond(
      {
        code: error instanceof TranscriptionTimeoutError ? "PROVIDER_TIMEOUT" : "PROVIDER_ERROR",
        requestId,
      },
      error instanceof TranscriptionTimeoutError ? 504 : 502,
    );
  }
}
