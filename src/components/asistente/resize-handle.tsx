import { View } from "react-native";
import { PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, usePanelStore } from "@/features/asistente/panel-store";

const STEP = 16;

/**
 * Borde izquierdo del panel (web): se arrastra con el mouse y se mueve con las flechas para
 * elegir su ancho (patrón «window splitter»). Como el panel está a la derecha, arrastrar a la
 * izquierda lo ensancha. El ancho se acota y se recuerda en `panel-store`.
 */
export function ResizeHandle() {
  const width = usePanelStore((state) => state.width);
  const setWidth = usePanelStore((state) => state.setWidth);

  // `onPointerDown` y `onKeyDown` solo existen en web (RNW); el panel acoplado no se pinta en nativo.
  const onPointerDown = (event: { clientX: number; preventDefault: () => void }) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const previousSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const move = (moved: PointerEvent) => setWidth(startWidth + startX - moved.clientX);
    const stop = () => {
      document.body.style.userSelect = previousSelect;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", stop);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
    document.addEventListener("pointercancel", stop);
  };
  const onKeyDown = (event: { key: string; preventDefault: () => void }) => {
    const delta = event.key === "ArrowLeft" ? STEP : event.key === "ArrowRight" ? -STEP : 0;
    if (delta === 0) return;
    event.preventDefault();
    setWidth(width + delta);
  };

  return (
    <View
      aria-label="Cambiar el ancho del asistente"
      aria-orientation="vertical"
      aria-valuemax={PANEL_MAX_WIDTH}
      aria-valuemin={PANEL_MIN_WIDTH}
      aria-valuenow={width}
      className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize bg-transparent hover:bg-border focus:bg-primary"
      role="separator"
      tabIndex={0}
      testID="assistant-resize"
      {...({ onKeyDown, onPointerDown } as object)}
    />
  );
}
