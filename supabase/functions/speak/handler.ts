import { corsHeaders } from "../_shared/transcription.ts";

/**
 * Voz de la respuesta del asistente (agente-conversacional · voz). Texto → audio con el proveedor.
 * Mismo acceso y misma cuota/consentimiento que la transcripción del chat: el texto de la respuesta es
 * dato clínico que sale al proveedor (Principio V). No registra el texto ni la credencial.
 */

export const MAX_SPEAK_CHARS = 1500;

export type QuotaStatus = "ok" | "rate_limited" | "consent_required" | "unavailable";

export type SpeakDependencies = {
  log: (line: string) => void;
  randomId: () => string;
  canUse: (authorization: string) => Promise<boolean>;
  consumeQuota: (authorization: string) => Promise<QuotaStatus>;
  /** MP3 de la locución; lanza ante un fallo del proveedor. */
  synthesize: (text: string) => Promise<Uint8Array>;
};

const respond = (body: Record<string, unknown>, status: number) =>
  Response.json(body, { status, headers: corsHeaders });

const base64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

export async function handleSpeak(request: Request, deps: SpeakDependencies): Promise<Response> {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const requestId = deps.randomId();
  const fallo = (code: string, status: number) => {
    deps.log(JSON.stringify({ event: "speak_rejected", requestId, code, status }));
    return respond({ code, requestId }, status);
  };
  if (request.method !== "POST") return fallo("METHOD_NOT_ALLOWED", 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return fallo("UNAUTHENTICATED", 401);

  let permitido = false;
  try {
    permitido = await deps.canUse(authorization);
  } catch {
    permitido = false;
  }
  if (!permitido) return fallo("FORBIDDEN", 403);

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_SPEAK_CHARS) return fallo("INVALID_INPUT", 400);

  let cuota: QuotaStatus = "unavailable";
  try {
    cuota = await deps.consumeQuota(authorization);
  } catch {
    cuota = "unavailable";
  }
  if (cuota === "consent_required") return fallo("CONSENT_REQUIRED", 403);
  if (cuota === "rate_limited") return fallo("RATE_LIMITED", 429);
  if (cuota !== "ok") return fallo("QUOTA_UNAVAILABLE", 503);

  const inicio = Date.now();
  try {
    const audio = await deps.synthesize(text);
    deps.log(
      JSON.stringify({
        event: "speak_done",
        requestId,
        bytes: audio.length,
        durationMs: Date.now() - inicio,
      }),
    );
    // JSON con base64: supabase-js solo devuelve binario para `application/octet-stream` y así se reproduce igual en web y nativo.
    return respond({ audio: base64(audio), mime: "audio/mpeg", requestId }, 200);
  } catch (error) {
    deps.log(
      JSON.stringify({
        event: "speak_failed",
        requestId,
        error: { name: error instanceof Error ? error.name : "Error" },
        durationMs: Date.now() - inicio,
      }),
    );
    return respond({ code: "PROVIDER_ERROR", requestId }, 502);
  }
}
