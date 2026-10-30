import { createClient } from "@supabase/supabase-js";
import { handleSpeak } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const TTS_MODEL = Deno.env.get("TTS_MODEL") ?? "gpt-4o-mini-tts";
const TTS_VOICE = Deno.env.get("TTS_VOICE") ?? "alloy";
const TIEMPO_MAXIMO_MS = 30_000;

const asUser = (authorization: string) =>
  createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

Deno.serve((request) =>
  handleSpeak(request, {
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
    canUse: async (authorization) => {
      const { data } = await asUser(authorization).rpc("is_active_access");
      return data === true;
    },
    // Misma cuota y aviso de primer uso que la transcripción del chat.
    consumeQuota: async (authorization) => {
      const { data, error } = await asUser(authorization).rpc("consume_assistant_audio_quota");
      if (error) return "unavailable";
      return data === "ok" || data === "rate_limited" || data === "consent_required"
        ? data
        : "unavailable";
    },
    synthesize: async (text) => {
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no configurada");
      const res = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: text,
          response_format: "mp3",
        }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      // Solo el estado: el cuerpo del proveedor no se propaga.
      if (!res.ok) throw new Error(`OPENAI_${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    },
  }),
);
