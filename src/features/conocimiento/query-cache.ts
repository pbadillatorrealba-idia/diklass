import type { QueryClient } from "@tanstack/react-query";

/** Prefijo de las consultas de React Query de la base de conocimiento. */
export const CONOCIMIENTO_QUERY_KEY = ["conocimiento"] as const;

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
