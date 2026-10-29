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
    run: ({ authorization, ...input }) =>
      runAgent({ model: MODEL, db: asUser(authorization), ...input }),
  }),
);
