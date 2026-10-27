/**
 * Anclaje de la lista de mensajes (asistente-conversacional «Lista de mensajes anclada» · design.md
 * D10): la decisión es pura y la comparten la lista web y la nativa, para que no diverjan.
 */
export const NEAR_BOTTOM_PX = 32;

export const isNearBottom = (metrics: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}) => metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= NEAR_BOTTOM_PX;

export type MessageDiff =
  | { kind: "initial"; appended: 0; prepended: 0 }
  | { kind: "change"; appended: number; prepended: number };

/**
 * Qué cambió entre dos listas de ids cronológicas: mensajes añadidos al final (nuevos) o al principio
 * («Cargar anteriores»). Una lista reemplazada por otra distinta no cuenta como nuevos.
 */
export function diffMessages(prev: readonly string[], next: readonly string[]): MessageDiff {
  if (prev.length === 0) return { kind: "initial", appended: 0, prepended: 0 };
  const first = next.indexOf(prev[0] as string);
  if (first === -1) return { kind: "change", appended: 0, prepended: 0 };
  // Lo que sigue a la parte común es nuevo: también el marcador «Pensando…» que se reemplaza por la
  // respuesta, que llega con otra id.
  let common = 0;
  while (common < prev.length && next[first + common] === prev[common]) common++;
  return { kind: "change", prepended: first, appended: next.length - first - common };
}

export type Anchor = { pinned: boolean; unseen: number };

/** Siguiente estado: anclado, lo nuevo se sigue; leyendo arriba, se cuenta y no se arrastra. */
export function nextAnchor(
  anchor: Anchor,
  event: { appended?: number; nearBottom?: boolean },
): Anchor {
  if (event.nearBottom === true) {
    return anchor.pinned && anchor.unseen === 0 ? anchor : { pinned: true, unseen: 0 };
  }
  if (event.nearBottom === false) return anchor.pinned ? { ...anchor, pinned: false } : anchor;
  if (event.appended && !anchor.pinned)
    return { ...anchor, unseen: anchor.unseen + event.appended };
  return anchor;
}

export type ScrollPlan = { to: "end" } | { to: number } | null;

/**
 * Qué hacer con el desplazamiento cuando el contenido cambia de tamaño. `y` y `height` son la
 * posición REAL de la vista en ese instante; `prevContent`, el alto de antes del cambio. Cargar
 * anteriores conserva lo que se leía; quien envía o está abajo sigue lo nuevo; quien lee arriba no se
 * mueve.
 */
export function planScroll(input: {
  y: number;
  height: number;
  prevContent: number;
  nextContent: number;
  keepPosition: boolean;
  forceEnd: boolean;
}): ScrollPlan {
  if (input.keepPosition) return { to: input.y + (input.nextContent - input.prevContent) };
  const wasNearBottom = isNearBottom({
    scrollTop: input.y,
    clientHeight: input.height,
    scrollHeight: input.prevContent,
  });
  return input.forceEnd || wasNearBottom ? { to: "end" } : null;
}

export const unseenLabel = (count: number) => (count === 1 ? "1 nuevo" : `${count} nuevos`);
