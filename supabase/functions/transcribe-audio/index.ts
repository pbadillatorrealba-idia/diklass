import { createClient } from "@supabase/supabase-js";
import { transcribeWithOpenAI } from "../_shared/transcription.ts";
import { handleTranscribeAudio } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const TIEMPO_MAXIMO_MS = 20_000;

/** La clave vive solo en los secretos de la función (Principio V); nunca llega al cliente. */
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const asUser = (authorization: string) =>
  createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

Deno.serve((request) =>
  handleTranscribeAudio(request, {
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
    // El cliente actúa con el JWT del solicitante, así que la RLS decide qué sesión ve.
    canTranscribe: async (authorization, listeningSessionId) => {
      const { data: sesion } = await asUser(authorization)
        .from("listening_sessions")
        .select("state, consultation_id")
        .eq("id", listeningSessionId)
        .maybeSingle();
      if (sesion?.state !== "active") return false;
      const { data: consulta } = await asUser(authorization)
        .from("clinical_records")
        .select("content")
        .eq("id", sesion.consultation_id)
        .eq("record_type", "consultation")
        .maybeSingle();
      return (consulta?.content as { status?: string } | null)?.status === "open";
    },
    // Cuota propia del dictado (no la del chat): un usuario activo no debe gastar la del proveedor.
    consumeQuota: async (authorization) => {
      const { data, error } = await asUser(authorization).rpc("consume_dictation_quota");
      if (error) return "unavailable";
      // `no_access` ya lo atrapó `canTranscribe` (la RLS devuelve vacío sin acceso activo).
      return data === "ok" || data === "rate_limited" ? data : "unavailable";
    },
    transcribe: (audio) =>
      transcribeWithOpenAI({ audio, apiKey: OPENAI_API_KEY, timeoutMs: TIEMPO_MAXIMO_MS }),
  }),
);
