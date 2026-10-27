/**
 * Devuelve el foco al control que abrió un cajón o una hoja al cerrarlos (WCAG 2.4.3). Se intenta
 * al terminar el turno y otra vez poco después: el `Modal` restaura el foco por su cuenta al
 * desmontarse y el orden entre ambos no está garantizado. Solo actúa si el foco quedó perdido
 * (en el `body` o en un nodo ya retirado), para no robárselo a quien ya lo movió.
 */
export function restoreFocus(getNode: () => HTMLElement | null) {
  const intentar = () => {
    const actual = document.activeElement;
    const perdido = !actual || actual === document.body || !actual.isConnected;
    if (perdido) getNode()?.focus({ preventScroll: true });
  };
  setTimeout(intentar, 0);
  setTimeout(intentar, 100);
}
