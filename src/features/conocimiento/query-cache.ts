import type { QueryClient } from "@tanstack/react-query";
import { REGISTRO_QUERY_KEY } from "@/features/registro/query-cache";

/** Prefijo de las consultas de React Query de la base de conocimiento. */
export const CONOCIMIENTO_QUERY_KEY = ["conocimiento"] as const;

/**
 * Pacientes del selector de contexto de la conversación. Son la misma lista que la del
 * registro (`listPatients`), así que comparten su clave: `invalidateRegistro`, que ya corre
 * tras crear un paciente, también refresca el selector (revisión de la PR #30).
 */
export const PACIENTES_CONTEXTO_QUERY_KEY = [...REGISTRO_QUERY_KEY, "patients"] as const;

/**
 * Marca como obsoleto todo lo leído de la base de conocimiento tras incorporar o retirar una
 * fuente: la colección, el visor de cada fuente y las reconstrucciones de consultas (que
 * marcan las citas hacia fuentes retiradas). Sin esto, el `staleTime` global de 30 s dejaba la
 * colección desfasada al volver a ella (revisión de la PR #30; mismo patrón que
 * `invalidateRegistro`).
 */
export function invalidateConocimiento(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: CONOCIMIENTO_QUERY_KEY });
}
