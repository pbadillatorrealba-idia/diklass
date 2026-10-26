import { usePathname } from "expo-router";
import { AsistenteThread } from "@/components/asistente/asistente-thread";
import { ConocimientoThread } from "@/components/conocimiento/conocimiento-thread";
import { usePanelThreads } from "@/features/asistente/panel-threads";

/**
 * Hilos que el propio shell ofrece en toda pantalla protegida (sistema-visual «Hilos contextuales
 * del panel» · design.md D3): «Asistente» (consultas básicas y conocimiento) y «Conocimiento». El
 * inicio solo ofrece «Asistente», que ya cubre el conocimiento, y por eso su panel no lleva
 * pestañas. Los hilos de una pantalla (p. ej. «Escucha») los declara la propia pantalla.
 */
export function ShellThreads() {
  const enInicio = usePathname() === "/home";
  usePanelThreads([
    ...(enInicio
      ? []
      : [
          {
            id: "conocimiento",
            label: "Conocimiento",
            icon: "book-open-page-variant-outline",
            element: <ConocimientoThread />,
          },
        ]),
    {
      id: "asistente",
      label: "Asistente",
      icon: "robot-outline",
      element: <AsistenteThread />,
    },
  ]);
  return null;
}
