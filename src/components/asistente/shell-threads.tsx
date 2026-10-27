import { usePathname } from "expo-router";
import { ChatThread } from "@/components/asistente/chat-thread";
import { ConocimientoThread } from "@/components/conocimiento/conocimiento-thread";
import { usePanelThreads } from "@/features/asistente/panel-threads";
import { useChatController } from "@/features/asistente/use-chat-controller";

/**
 * Hilos que el propio shell ofrece en toda pantalla protegida (sistema-visual «Hilos contextuales
 * del panel» · design.md D3): «Asistente» (el chat) y «Conocimiento». El inicio solo ofrece
 * «Asistente», que ya cubre el conocimiento, y por eso su panel no lleva pestañas. Los hilos de una
 * pantalla (p. ej. «Escucha») los declara la propia pantalla. El controlador del chat vive aquí,
 * siempre montado, para que una respuesta con el panel cerrado se registre y marque el no leído.
 */
export function ShellThreads() {
  const enInicio = usePathname() === "/home";
  const chat = useChatController();
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
      element: <ChatThread chat={chat} />,
      scroll: false,
      unread: chat.unread,
    },
  ]);
  return null;
}
