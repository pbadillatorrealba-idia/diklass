import {
  calidad,
  corsHeaders,
  MIME_PERMITIDOS,
  TranscriptionTimeoutError,
  tipoBase,
} from "../_shared/transcription.ts";

/**
 * Transcripción de un mensaje de voz del chat (cambio chat-del-asistente, D5). A diferencia de
 * `transcribe-audio`, no exige una sesión de escucha: basta un usuario autenticado de la clínica con
 * acceso activo. Handler puro con dependencias inyectadas. Nunca registra audio, texto transcrito ni
 * la credencial: el texto es dato clínico (Principio V) y la bitácora lleva solo identificadores,
 * estado y tamaños.
 */

/**
 * Tope de 2 minutos por TAMAÑO, no por duración: la duración que declare el cliente no es un control de
 * confianza (Principio V) y el servidor no la conoce sin decodificar. 5 MiB cubren 2 min a ~330 kbps,
 * por encima del bitrate de `MediaRecorder` (Opus) y de AAC en móvil. Coincide con el bucket
 * `assistant-audio`.
 */
export const MAX_CHAT_AUDIO_BYTES = 5 * 1024 * 1024;
const MARGEN_MULTIPART_BYTES = 64 * 1024;

export type TranscribeChatDependencies = {
  log: (line: string) => void;
  randomId: () => string;
  /** El solicitante está autenticado y tiene acceso activo en su clínica; sin sesión de escucha. */
  canTranscribe: (authorization: string) => Promise<boolean>;
  /** Devuelve el texto transcrito; lanza TranscriptionTimeoutError al exceder el tiempo máximo. */
  transcribe: (audio: Blob) => Promise<string>;
};

const respond = (body: Record<string, unknown>, status: number) =>
  Response.json(body, { status, headers: corsHeaders });

export async function handleTranscribeChatAudio(
  request: Request,
  deps: TranscribeChatDependencies,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const requestId = deps.randomId();
  const fallo = (code: string, status: number) => {
    deps.log(
      JSON.stringify({
        event: "transcribe_chat_audio_rejected",
        requestId,
        code,
        status,
        timestamp: new Date().toISOString(),
      }),
    );
    return respond({ code, requestId }, status);
  };

  if (request.method !== "POST") return fallo("METHOD_NOT_ALLOWED", 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return fallo("UNAUTHENTICATED", 401);

  // Antes de parsear: `formData()` bufferiza el cuerpo entero, así que un multipart enorme se
  // rechaza por la cabecera declarada (el margen cubre los campos y los límites del multipart).
  const declarado = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declarado) && declarado > MAX_CHAT_AUDIO_BYTES + MARGEN_MULTIPART_BYTES) {
    return fallo("PAYLOAD_TOO_LARGE", 413);
  }

  let form: globalThis.FormData;
  try {
    form = (await request.formData()) as unknown as globalThis.FormData;
  } catch {
    return fallo("INVALID_INPUT", 400);
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || !MIME_PERMITIDOS.has(tipoBase(audio))) {
    return fallo("INVALID_INPUT", 400);
  }
  if (audio.size > MAX_CHAT_AUDIO_BYTES) return fallo("PAYLOAD_TOO_LARGE", 413);

  // Fallo cerrado: ante cualquier error al comprobar, no se envía audio al proveedor.
  let permitido = false;
  try {
    permitido = await deps.canTranscribe(authorization);
  } catch {
    permitido = false;
  }
  if (!permitido) return fallo("FORBIDDEN", 403);

  const inicio = Date.now();
  try {
    const text = (await deps.transcribe(audio)).trim();
    const quality = calidad(text);
    deps.log(
      JSON.stringify({
        event: "transcribe_chat_audio_done",
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
        event: "transcribe_chat_audio_failed",
        requestId,
        error: { name: error instanceof Error ? error.name : "Error" },
        durationMs: Date.now() - inicio,
        timestamp: new Date().toISOString(),
      }),
    );
    const timeout = error instanceof TranscriptionTimeoutError;
    return respond(
      { code: timeout ? "PROVIDER_TIMEOUT" : "PROVIDER_ERROR", requestId },
      timeout ? 504 : 502,
    );
  }
}
