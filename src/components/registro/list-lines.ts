/**
 * Un ítem por línea es la representación editable de un `string[]` del contenido: la
 * conversión (partir, recortar y descartar líneas vacías) es idéntica en los cuatro campos
 * de lista de la epicrisis.
 */
export function linesToItems(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * Texto que muestra el campo: el que el usuario está escribiendo mientras siga
 * representando la misma lista, o la lista del contenido si esta cambió desde fuera (un
 * borrador regenerado o recargado). Sin esto el campo se reescribía con la lista ya
 * recortada en cada pulsación y no admitía espacios ni saltos de línea (revisión de la
 * PR #27).
 */
export function visibleListText(typed: string, items: string[]): string {
  const typedItems = linesToItems(typed);
  const same =
    typedItems.length === items.length && typedItems.every((item, index) => item === items[index]);
  return same ? typed : items.join("\n");
}
