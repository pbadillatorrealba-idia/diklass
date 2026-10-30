export type Turn = {
  signal: AbortSignal;
  /** Libera la puerta; un `end` tardío de un turno viejo no libera el de uno nuevo. */
  end: () => void;
  /** `false` tras `invalidate`: el turno no debe escribir en una conversación ya borrada. */
  isCurrent: () => boolean;
};

/**
 * Puerta del turno en curso (asistente-conversacional «Composer del chat»): hay un solo turno a la
 * vez y es de la sesión, no de cada instancia del controlador —el chat del panel y el de `/knowledge`
 * comparten la conversación—, así que «Detener» en uno corta la respuesta del otro.
 */
export function createTurnGate() {
  let active: { controller: AbortController; id: number } | null = null;
  let generation = 0;
  let nextId = 0;
  return {
    begin(): Turn | null {
      if (active) return null;
      const controller = new AbortController();
      const id = ++nextId;
      const born = generation;
      active = { controller, id };
      return {
        signal: controller.signal,
        end: () => {
          if (active?.id === id) active = null;
        },
        isCurrent: () => generation === born,
      };
    },
    abort() {
      active?.controller.abort();
    },
    /** Borrar la conversación: aborta el turno en vuelo, lo deja obsoleto y libera la puerta. */
    invalidate() {
      generation++;
      active?.controller.abort();
      active = null;
    },
  };
}
