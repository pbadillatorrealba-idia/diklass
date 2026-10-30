/**
 * Texto de la región de estado de la conversación (asistente-conversacional «Accesibilidad de la
 * conversación»): «Pensando…» mientras responde y «Respuesta lista» al terminar con éxito. Va en una
 * región separada de la lista, así el cuerpo de la respuesta no es una región viva y el lector la
 * anuncia una sola vez. `null` = no cambia.
 */
export function nextStatusText(
  wasThinking: boolean,
  thinking: boolean,
  finishedWithAnswer: boolean,
): string | null {
  if (thinking) return "Pensando…";
  if (wasThinking) return finishedWithAnswer ? "Respuesta lista" : "";
  return null;
}
