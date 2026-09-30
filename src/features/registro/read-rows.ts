import type { z } from "zod";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
import { logEvent } from "@/lib/observability/logger";

/**
 * Frontera de lectura tolerante de las listas del registro: cada fila se valida con su
 * esquema, y una fila ajena al contrato o malformada se omite con un log estructurado en vez
 * de tumbar la lista entera. La escritura sigue siendo estricta.
 */
export function parseRows<Content>(
  rows: ClinicalRecordRow[] | null,
  schema: z.ZodType<Content>,
  operation: string,
): Array<{ record: ClinicalRecordRow; content: Content }> {
  return (rows ?? []).flatMap((row) => {
    const legible = schema.safeParse(row.content);
    if (!legible.success) {
      logEvent(
        "registro.row_content_skipped",
        { operation, recordId: row.id, errorName: "ZodError" },
        "error",
      );
      return [];
    }
    return [{ record: row, content: legible.data }];
  });
}

/** Filas pedidas por página: el `max_rows` por defecto de PostgREST en Supabase. */
export const PAGE_SIZE = 1000;

/**
 * Lee todas las filas de una lista de la clínica por páginas (sistema-visual 12.11).
 * PostgREST corta cada respuesta en su `max_rows` sin avisar: una lista ordenada de la más antigua
 * a la más reciente perdía así las fichas nuevas. El total sale de `count: "exact"` y no del tamaño
 * de la página, porque el tope del servidor puede ser menor que `PAGE_SIZE` (revisión de la PR #41).
 * `page` debe pedir `count: "exact"` y aplicar un orden total (p. ej. `created_at` e `id`) para que
 * las páginas no se solapen ni dejen huecos.
 */
export async function readAllPages(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: ClinicalRecordRow[] | null; error: unknown; count: number | null }>,
): Promise<ClinicalRecordRow[]> {
  const rows: ClinicalRecordRow[] = [];
  for (;;) {
    const from = rows.length;
    const { data, error, count } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    rows.push(...(data ?? []));
    // Sin total, o sin avance, no hay forma segura de seguir: se devuelve lo leído.
    if (count === null || !data?.length || rows.length >= count) {
      return rows;
    }
  }
}
