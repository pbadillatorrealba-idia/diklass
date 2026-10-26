import { useWindowDimensions } from "react-native";
import { contentWidthFor, usePanelStore } from "@/features/asistente/panel-store";

/**
 * Ancho que le queda al contenido de la pantalla: en web, lo que deja el shell (barra lateral y
 * panel de asistente); en nativo, la ventana. Las composiciones que dependen del ancho del
 * contenido (columnas de una lista, tabla o tarjetas) deben medir esto y no la ventana, porque el
 * panel acoplado le quita 360 px al contenido sin cambiar la ventana (sistema-visual «Shell de
 * tres zonas»).
 */
export function useContentWidth(): number {
  const windowWidth = useWindowDimensions().width;
  const expanded = usePanelStore((state) => state.expanded);
  const width = usePanelStore((state) => state.width);
  return process.env.EXPO_OS === "web"
    ? contentWidthFor(windowWidth, expanded, width)
    : windowWidth;
}
