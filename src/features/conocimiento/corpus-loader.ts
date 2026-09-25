import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { incorporateSource } from "./coleccion-service";
import { fuenteContentSchema } from "./schema";

/**
 * Carga del corpus documental sintético por la misma puerta de escritura que la ingesta
 * manual desde la UI (D9 del diseño del cambio; decisión de usuario: corpus sintético con
 * estructura de citas documento+fragmento y metadatos de licencia, en fixtures propios y
 * nunca en `supabase/seed.sql`).
 */

export const corpusSinteticoSchema = z.object({
  fuentes: z
    .array(z.object({ clave: z.string().trim().min(1), fuente: fuenteContentSchema }))
    .min(1, "El corpus sintético trae al menos una fuente."),
});

export type CorpusSintetico = z.infer<typeof corpusSinteticoSchema>;

/**
 * Incorpora cada fuente del corpus y devuelve el mapa de claves del fixture al identificador
 * incorporado (lo usa el arnés de evaluación para referenciar la evidencia esperada).
 */
export async function loadSyntheticCorpus(
  client: SupabaseClient<Database>,
  input: { clinicId: string; corpus: unknown },
): Promise<{ claves: Record<string, string> }> {
  const corpus = corpusSinteticoSchema.parse(input.corpus);
  const claves: Record<string, string> = {};
  for (const entrada of corpus.fuentes) {
    const alta = await incorporateSource(client, {
      clinicId: input.clinicId,
      fuente: entrada.fuente,
    });
    claves[entrada.clave] = alta.record.record.id;
  }
  return { claves };
}
