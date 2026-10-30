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

Deno.serve((request) =>
  handleTranscribeAudio(request, {
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
    // El cliente actúa con el JWT del solicitante, así que la RLS decide qué sesión ve.
    canTranscribe: async (authorization, listeningSessionId) => {
      const user = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const { data: sesion } = await user
        .from("listening_sessions")
        .select("state, consultation_id")
        .eq("id", listeningSessionId)
        .maybeSingle();
      if (sesion?.state !== "active") return false;
      const { data: consulta } = await user
        .from("clinical_records")
        .select("content")
        .eq("id", sesion.consultation_id)
        .eq("record_type", "consultation")
        .maybeSingle();
      return (consulta?.content as { status?: string } | null)?.status === "open";
    },
    transcribe: (audio) =>
      transcribeWithOpenAI({ audio, apiKey: OPENAI_API_KEY, timeoutMs: TIEMPO_MAXIMO_MS }),
  }),
);
