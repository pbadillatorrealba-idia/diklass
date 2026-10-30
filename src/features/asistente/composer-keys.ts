/** Líneas visibles del composer antes de desplazarse por dentro (asistente-conversacional «Composer»). */
export const MAX_LINES = 6;

type TeclaEvento = { key: string; shiftKey?: boolean; isComposing?: boolean; keyCode?: number };

/**
 * En web, Enter envía y Shift+Enter inserta un salto de línea, pero nunca mientras una composición
 * IME está activa (Enter confirma la palabra); `keyCode 229` es la marca de composición de Safari.
 * En nativo no se usa: Enter inserta el salto y se envía solo con el botón.
 */
export const sendOnKey = (event: TeclaEvento) =>
  event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
