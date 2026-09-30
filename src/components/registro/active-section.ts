export type SectionNumber = 1 | 2 | 3;

/**
 * Sección activa al cargar la consulta (aclaración de D20, 2026-09-30): el paso siguiente del
 * protocolo. Después manda la última sección editada.
 */
export function initialActiveSection({
  isClosed,
  hasDraft,
}: {
  isClosed: boolean;
  hasDraft: boolean;
}): SectionNumber | null {
  if (isClosed) return null;
  return hasDraft ? 3 : 1;
}
