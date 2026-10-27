import { useWindowDimensions, View } from "react-native";
import { ChatThread } from "@/components/asistente/chat-thread";
import { Screen } from "@/components/ui/screen";
import { useChatController } from "@/features/asistente/use-chat-controller";

/**
 * Conversación con el asistente de la base de conocimiento (FR-005, FR-026 · US5-AC1/AC4). Muestra el
 * mismo chat que el panel del shell, a pantalla completa: la misma conversación y el mismo paciente de
 * contexto, que fija la navegación y no un selector.
 */
export default function KnowledgeConversationScreen() {
  const chat = useChatController();
  const { height } = useWindowDimensions();
  return (
    <Screen title="Base de conocimiento · Consulta">
      {/* El chat lleva su propio desplazamiento y su composer al pie: necesita una altura acotada. */}
      <View
        className="rounded-sm border border-border bg-card"
        style={{ height: Math.max(480, height - 260) }}
        testID="knowledge-chat"
      >
        <ChatThread chat={chat} />
      </View>
    </Screen>
  );
}
