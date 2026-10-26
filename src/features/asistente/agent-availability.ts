/**
 * Disponibilidad de un agente conversacional (sistema-visual «Hilo del asistente reservado»).
 * El agente real —LLM, herramientas, seguridad y la revisión de la decisión dura HD1— es un
 * cambio futuro aparte: hasta entonces es siempre `false` y el hilo «Asistente» declara que no
 * está disponible, sin simular respuestas ni propuestas.
 */
export function useAgentAvailability(): boolean {
  return false;
}
