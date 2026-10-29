import * as z from "zod";
import { corsHeaders } from "../_shared/transcription.ts";
import type { AgentResult, HistoryItem } from "./agent.ts";

/**
 * Turno del agente (agente-conversacional). Handler puro con dependencias inyectadas: autentica,
 * valida el cuerpo y delega. No registra el texto del usuario ni la credencial (Principio V): la
 * bitácora lleva solo identificador, estado y duración.
 */

const Body = z.object({
  text: z.string().trim().min(1).max(4000),
  patientId: z.string().uuid().nullable().default(null),
  since: z.string().datetime({ offset: true }).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(20)
    .default([]),
});

export type AgentDependencies = {
  log: (line: string) => void;
  randomId: () => string;
  /** Usuario autenticado de la clínica con acceso activo (con su JWT). */
  canUse: (authorization: string) => Promise<boolean>;
  run: (input: {
    authorization: string;
    text: string;
    patientId: string | null;
    since?: string;
    history: HistoryItem[];
  }) => Promise<AgentResult>;
};

const respond = (body: Record<string, unknown>, status: number) =>
  Response.json(body, { status, headers: corsHeaders });

export async function handleAgent(request: Request, deps: AgentDependencies): Promise<Response> {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const requestId = deps.randomId();
  const fallo = (code: string, status: number) => {
    deps.log(JSON.stringify({ event: "agent_rejected", requestId, code, status }));
    return respond({ code, requestId }, status);
  };
  if (request.method !== "POST") return fallo("METHOD_NOT_ALLOWED", 405);
  const authorization = request.headers.get("Authorization");
  if (!authorization) return fallo("UNAUTHENTICATED", 401);

  // Fallo cerrado: ante cualquier error al comprobar, no se llama al modelo.
  let permitido = false;
  try {
    permitido = await deps.canUse(authorization);
  } catch {
    permitido = false;
  }
  if (!permitido) return fallo("FORBIDDEN", 403);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fallo("INVALID_INPUT", 400);

  const inicio = Date.now();
  try {
    const result = await deps.run({ authorization, ...parsed.data });
    deps.log(JSON.stringify({ event: "agent_done", requestId, durationMs: Date.now() - inicio }));
    return respond({ ...result, requestId }, 200);
  } catch (error) {
    // Solo el nombre de la clase: el mensaje del proveedor podría arrastrar la credencial.
    deps.log(
      JSON.stringify({
        event: "agent_failed",
        requestId,
        error: { name: error instanceof Error ? error.name : "Error" },
        durationMs: Date.now() - inicio,
      }),
    );
    return respond({ code: "AGENT_ERROR", requestId }, 502);
  }
}
