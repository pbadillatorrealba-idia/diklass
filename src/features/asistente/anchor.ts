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
  if (first === -1 || next[first + prev.length - 1] !== prev.at(-1)) {
    return { kind: "change", appended: 0, prepended: 0 };
  }
  return {
    kind: "change",
    prepended: first,
    appended: next.length - first - prev.length,
  };
}

export type Anchor = { pinned: boolean; unseen: number };

/** Siguiente estado: anclado, lo nuevo se sigue; leyendo arriba, se cuenta y no se arrastra. */
export function nextAnchor(
  anchor: Anchor,
  event: { appended?: number; nearBottom?: boolean },
): Anchor {
  if (event.nearBottom === true) return { pinned: true, unseen: 0 };
  if (event.nearBottom === false) return { ...anchor, pinned: false };
  if (event.appended && !anchor.pinned)
    return { ...anchor, unseen: anchor.unseen + event.appended };
  return anchor;
}

export const unseenLabel = (count: number) => (count === 1 ? "1 nuevo" : `${count} nuevos`);
