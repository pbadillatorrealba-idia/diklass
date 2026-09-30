import { EPICRISIS_FIELD_LABELS } from "@/components/registro/labels";
import type { EpicrisisContent } from "@/features/registro/schema";

export type EpicrisisField = keyof typeof EPICRISIS_FIELD_LABELS;

export type EpicrisisChange = {
  field: EpicrisisField;
  label: string;
  previous: string;
  current: string;
};

/** Valor de lectura de un campo: las listas, un ítem por línea, como se editan. */
function display(content: EpicrisisContent, field: EpicrisisField): string {
  switch (field) {
    case "hipotesis":
      return content.hipotesis.map(({ texto, estado }) => `${texto} (${estado})`).join("\n");
    case "planSeguimiento":
      return content.planSeguimiento.pendientes.join("\n");
    case "examenesSolicitados":
    case "intervencionesPropuestas":
    case "medicamentosAprobados":
      return content[field].join("\n");
    default:
      return content[field];
  }
}

/**
 * Campos que cambiaron entre la versión aprobada y la correctiva (FR-098 · design.md D20), en el
 * orden del formulario, con ambos valores tal como se leen.
 */
export function epicrisisChanges(
  previous: EpicrisisContent,
  current: EpicrisisContent,
): EpicrisisChange[] {
  return (Object.keys(EPICRISIS_FIELD_LABELS) as EpicrisisField[]).flatMap((field) => {
    const [before, after] = [display(previous, field), display(current, field)];
    return before === after
      ? []
      : [{ field, label: EPICRISIS_FIELD_LABELS[field], previous: before, current: after }];
  });
}
