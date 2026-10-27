import { usePathname } from "expo-router";
import { ChatThread } from "@/components/asistente/chat-thread";
import { chatOwnsScreen, usePanelThreads } from "@/features/asistente/panel-threads";
import { useChatController } from "@/features/asistente/use-chat-controller";

/**
 * Hilo que el propio shell ofrece en toda pantalla protegida (sistema-visual «Hilos contextuales del
 * panel» · design.md D3): «Asistente», el chat, que también responde a la base de conocimiento. Los
 * hilos de una pantalla (p. ej. «Escucha») los declara la propia pantalla. El controlador del chat vive
 * aquí, siempre montado, para que una respuesta con el panel cerrado se registre y marque el no leído.
 */
export function ShellThreads() {
  const chat = useChatController();
  // En /knowledge el chat ocupa la pantalla: el panel no ofrece otro.
  const cedido = chatOwnsScreen(usePathname());
  usePanelThreads(
    cedido
      ? []
      : [
          {
            id: "asistente",
            label: "Asistente",
            icon: "robot-outline",
            element: <ChatThread chat={chat} />,
            scroll: false,
            unread: chat.unread,
          },
        ],
  );
  return null;
}
