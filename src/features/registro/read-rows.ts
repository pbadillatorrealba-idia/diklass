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

/** Tope de filas por respuesta de PostgREST (`max_rows`, 1000 por defecto en Supabase). */
export const PAGE_SIZE = 1000;

/**
 * Lee todas las filas de una lista de la clínica en páginas de `PAGE_SIZE` (sistema-visual 12.11).
 * PostgREST corta cada respuesta en el tope sin avisar: una lista ordenada de la más antigua a la
 * más reciente perdía así las fichas nuevas. `page` debe aplicar un orden total (p. ej.
 * `created_at` e `id`) para que las páginas no se solapen ni dejen huecos.
 */
export async function readAllPages(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: ClinicalRecordRow[] | null; error: unknown }>,
): Promise<ClinicalRecordRow[]> {
  const rows: ClinicalRecordRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) {
      return rows;
    }
  }
}
