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
