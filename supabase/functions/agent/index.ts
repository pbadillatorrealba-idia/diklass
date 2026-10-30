import { asUser } from "../_shared/supabase.ts";
import { runAgent } from "./agent.ts";
import { makeDb } from "./db.ts";
import { handleAgent } from "./handler.ts";
import { makeModel } from "./model.ts";
import { setupTracing } from "./tracing.ts";

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  env: { get: (name: string) => string | undefined };
};

/** `proveedor:modelo` (openai, anthropic, google-genai); las claves viven solo en los secretos (Principio V). */
const MODEL = Deno.env.get("AGENT_MODEL") ?? "openai:gpt-6-luna";

/** Phoenix es opt-in: sin `PHOENIX_COLLECTOR_ENDPOINT` no se instrumenta nada. */
const tracing = setupTracing({
  endpoint: Deno.env.get("PHOENIX_COLLECTOR_ENDPOINT"),
  apiKey: Deno.env.get("PHOENIX_API_KEY"),
});

Deno.serve((request) =>
  handleAgent(request, {
    log: (line) => console.error(line),
    randomId: () => crypto.randomUUID(),
    // `asUser` actúa con el JWT del solicitante: RLS limita cada herramienta a su clínica.
    canUse: async (authorization) => {
      const { data } = await asUser(authorization).rpc("is_active_access");
      return data === true;
    },
    consumeQuota: async (authorization) => {
      const { data, error } = await asUser(authorization).rpc("consume_agent_quota");
      return !error && (data === "ok" || data === "rate_limited") ? data : "unavailable";
    },
    run: async ({ authorization, ...input }) => {
      const client = asUser(authorization);
      const turno = async () =>
        runAgent({
          model: await makeModel(MODEL),
          db: makeDb(client),
          ...input,
        });
      if (!tracing) return turno();
      try {
        const { result, traceId } = await tracing.turn(turno);
        return { ...result, traceId };
      } finally {
        // La función puede terminar en cuanto responde: se envía lo pendiente antes.
        await tracing.flush().catch(() => {});
      }
    },
  }),
);
