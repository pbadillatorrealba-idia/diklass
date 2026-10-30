import type { SupabaseClient } from "@supabase/supabase-js";
import * as z from "zod";
import { proposalActionSchema } from "@/features/asistente/proposal-action";

/** Tiempo máximo de un turno del agente (varias llamadas al modelo y a herramientas). */
const AGENT_TIMEOUT_MS = 60_000;

const fuenteSchema = z.object({
  documentoId: z.string(),
  ordinal: z.number(),
  titulo: z.string(),
  seccion: z.string().nullable(),
});

const respuestaSchema = z.object({
  text: z.string(),
  ui: z.array(z.object({ type: z.literal("navigate"), path: z.string() })).default([]),
  proposals: z
    .array(
      z.object({
        id: z.string(),
        summary: z.string(),
        origin: z.string(),
        action: proposalActionSchema,
      }),
    )
    .default([]),
  tools: z.array(z.string()).default([]),
  sources: z.array(fuenteSchema).default([]),
  traceId: z.string().optional(),
});

type AgentClient = Pick<SupabaseClient, "functions">;

/** Llama a la Edge Function `agent`; todo fallo se propaga para que el mensaje quede en «Reintentar». */
export async function invokeAgent(
  client: AgentClient,
  body: {
    text: string;
    patientId: string | null;
    /** Inicio del día local: el agente lo usa para «hoy». */
    since?: string;
    history: { role: "user" | "assistant"; text: string }[];
  },
) {
  const { data, error } = await client.functions.invoke("agent", {
    body,
    timeout: AGENT_TIMEOUT_MS,
  });
  if (error) throw error;
  return respuestaSchema.parse(data);
}
