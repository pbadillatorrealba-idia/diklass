import { createClient } from "@supabase/supabase-js";
import { runAgent } from "./agent.ts";
import { handleAgent } from "./handler.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

/** `proveedor:modelo` (openai, anthropic, google-genai); las claves viven solo en los secretos (Principio V). */
const MODEL = Deno.env.get("AGENT_MODEL") ?? "openai:gpt-5.5";

// El cliente actúa con el JWT del solicitante: RLS limita cada herramienta a su clínica.
const asUser = (authorization: string) =>
  createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

Deno.serve((request) =>
  handleAgent(request, {
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
    canUse: async (authorization) => {
      const { data } = await asUser(authorization).rpc("is_active_access");
      return data === true;
    },
    run: ({ authorization, ...input }) => {
      const client = asUser(authorization);
      return runAgent({
        model: MODEL,
        db: {
          consultationsSince: async (sinceIso) => {
            const { data, error } = await client
              .from("clinical_records")
              .select("id, created_at, content")
              .eq("record_type", "consultation")
              .gte("created_at", sinceIso)
              .order("created_at", { ascending: true })
              .limit(50);
            if (error) throw error;
            const ids = [
              ...new Set(
                (data ?? []).map((r) => String((r.content as { patientId?: string }).patientId)),
              ),
            ];
            const { data: pacientes, error: e2 } = await client
              .from("clinical_records")
              .select("id, content")
              .eq("record_type", "patient")
              .in("id", ids);
            if (e2) throw e2;
            const nombres = new Map(
              (pacientes ?? []).map((p) => [
                p.id,
                String((p.content as { name?: string }).name ?? ""),
              ]),
            );
            return (data ?? []).map((r) => {
              const c = r.content as { patientId?: string; status?: string };
              return {
                paciente: nombres.get(String(c.patientId)) ?? "",
                estado: c.status === "open" ? "abierta" : "cerrada",
                creada: r.created_at,
              };
            });
          },
          rpc: (fn, args) => client.rpc(fn, args),
          openConsultations: async (patientId) => {
            const { data, error } = await client
              .from("clinical_records")
              .select("id")
              .eq("record_type", "consultation")
              .eq("content->>patientId", patientId)
              .eq("content->>status", "open")
              .limit(20);
            if (error) throw error;
            return (data ?? []).map((r) => r.id);
          },
        },
        ...input,
      });
    },
  }),
);
