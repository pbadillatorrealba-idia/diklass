import type { QueryClient } from "@tanstack/react-query";

/** Prefijo de todas las consultas de React Query del registro clínico. */
export const REGISTRO_QUERY_KEY = ["registro"] as const;

/**
 * Marca como obsoleto todo lo leído del registro tras una escritura y vuelve a pedir lo que
 * está en pantalla. Una escritura cambia varias vistas a la vez (la ficha, la lista de
 * tutores, el historial, el workspace de la consulta), y el `staleTime` global de 30 s las
 * dejaría desfasadas al navegar entre ellas (revisión de la PR #27).
 */
export function invalidateRegistro(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: REGISTRO_QUERY_KEY });
}
