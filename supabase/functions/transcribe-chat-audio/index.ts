import { createClient } from "@supabase/supabase-js";
import { transcribeWithOpenAI } from "../_shared/transcription.ts";
import { handleTranscribeChatAudio } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

/** 2 min de audio con el proveedor: 20 s daría `TRANSCRIPTION_TIMEOUT` frecuentes (design.md D5). */
const TIEMPO_MAXIMO_MS = 60_000;

/** La clave vive solo en los secretos de la función (Principio V); nunca llega al cliente. */
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

Deno.serve((request) =>
  handleTranscribeChatAudio(request, {
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
    // El cliente actúa con el JWT del solicitante: `is_active_access` solo responde por él mismo.
    canTranscribe: async (authorization) => {
      const user = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const { data } = await user.rpc("is_active_access");
      return data === true;
    },
    // Cuota por usuario, en la base y con su JWT: un usuario activo no debe gastar la cuota del proveedor.
    consumeQuota: async (authorization) => {
      const user = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        {
          global: { headers: { Authorization: authorization } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const { data } = await user.rpc("consume_assistant_audio_quota");
      return data === true;
    },
    transcribe: (audio) =>
      transcribeWithOpenAI({ audio, apiKey: OPENAI_API_KEY, timeoutMs: TIEMPO_MAXIMO_MS }),
  }),
);
