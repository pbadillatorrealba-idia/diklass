import { createClient } from "@supabase/supabase-js";
import { handleTranscribeAudio, TranscriptionTimeoutError } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

const MODELO = "gpt-transcribe";
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
    transcribe: async (audio) => {
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY no configurada");
      const form = new FormData();
      form.set("file", audio, audio.type.includes("webm") ? "tramo.webm" : "tramo.m4a");
      form.set("model", MODELO);
      form.set("language", "es");
      form.set("response_format", "json");
      let respuesta: Response;
      try {
        respuesta = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: form,
          signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
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
    },
  }),
);
