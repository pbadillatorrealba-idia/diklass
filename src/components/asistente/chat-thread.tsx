import { useEffect, useState } from "react";
import { View } from "react-native";
import { Composer } from "@/components/asistente/composer";
import { MessageList } from "@/components/asistente/message-list";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useChatStore } from "@/features/asistente/chat-store";
import type { ChatController } from "@/features/asistente/use-chat-controller";

const SUGERENCIAS = [
  "¿Qué día es hoy?",
  "¿Qué eventos tengo agendados?",
  "¿Cuáles son los pacientes de hoy?",
] as const;

const THREAD_ID = "asistente";

/**
 * Hilo «Asistente» como chat (asistente-conversacional · design.md D10 · D12): la lista de mensajes
 * anclada, el composer fijo al pie y «Borrar conversación» con su confirmación. Que el hilo esté
 * montado significa que está a la vista, así que abrirlo pone a cero el no leído.
 */
export function ChatThread({ chat }: { chat: ChatController }) {
  const draft = useChatStore((state) => state.drafts[THREAD_ID] ?? "");
  const setDraft = useChatStore((state) => state.setDraft);
  const clearUnread = useChatStore((state) => state.clearUnread);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: se repite con cada mensaje que llega.
  useEffect(() => {
    clearUnread();
  }, [chat.messages.length, clearUnread]);

  const borrar = async () => {
    try {
      await chat.clear();
      setConfirming(false);
      setStatus(null);
    } catch {
      setStatus("No se pudo borrar la conversación. Inténtalo de nuevo.");
    }
  };

  const vacio = chat.messages.length === 0 && !chat.isLoading;

  return (
    <View className="min-h-0 flex-1" testID="chat-thread">
      <View className="flex-row items-center justify-between gap-2 px-3 pt-2">
        <Text className="flex-1" tone="muted" variant="caption">
          Pregunta por la fecha, tu agenda o los pacientes de hoy; lo demás lo busco en la base de
          conocimiento. No escribo en el registro clínico.
        </Text>
        {chat.messages.length > 0 ? (
          <Button onPress={() => setConfirming(true)} size="sm" testID="chat-clear" variant="ghost">
            <ButtonText>Borrar conversación</ButtonText>
          </Button>
        ) : null}
      </View>

      {chat.context !== null ? (
        // Contexto automático de solo lectura: lo fija la navegación, no un selector (FR-026).
        <Text className="px-3 pt-2" tone="muted" testID="chat-context" variant="caption">
          {`Contexto: ${chat.context.name ?? "paciente"}`}
        </Text>
      ) : null}

      {confirming ? (
        <View
          className="mx-3 mt-2 gap-2 rounded-sm border border-border bg-card p-3"
          role="alertdialog"
          testID="chat-clear-confirm"
        >
          <Text>
            Se borrará toda tu conversación con el asistente, incluido el audio. Las consultas a la
            base de conocimiento seguirán registradas como auditoría (FR-020).
          </Text>
          <View className="flex-row gap-2">
            <Button
              onPress={() => void borrar()}
              size="sm"
              testID="chat-clear-yes"
              variant="destructive"
            >
              <ButtonText>Borrar</ButtonText>
            </Button>
            <Button
              onPress={() => setConfirming(false)}
              size="sm"
              testID="chat-clear-no"
              variant="outline"
            >
              <ButtonText>Cancelar</ButtonText>
            </Button>
          </View>
        </View>
      ) : null}
      {status !== null ? (
        <Text className="px-3 pt-2" tone="destructive" variant="caption">
          {status}
        </Text>
      ) : null}

      {vacio ? (
        <View className="gap-2 px-3 pt-3" testID="asistente-sugerencias">
          {SUGERENCIAS.map((sugerencia) => (
            <Button
              className="items-start"
              isDisabled={chat.isResponding}
              key={sugerencia}
              onPress={() => void chat.send(sugerencia)}
              variant="outline"
            >
              <ButtonText>{sugerencia}</ButtonText>
            </Button>
          ))}
        </View>
      ) : null}

      <MessageList
        hasOlder={chat.hasOlder}
        isLoading={chat.isLoading}
        isLoadingOlder={chat.isLoadingOlder}
        messages={chat.messages}
        onCopy={(text) => void chat.copy(text)}
        onLoadOlder={() => void chat.loadOlder()}
        onRetry={(id) => void chat.retry(id)}
      />

      <View className="border-t border-border p-3">
        <Composer
          isResponding={chat.isResponding}
          onChangeText={(text) => setDraft(THREAD_ID, text)}
          onSend={(text) => {
            setDraft(THREAD_ID, "");
            void chat.send(text);
          }}
          onStop={chat.stop}
          value={draft}
        />
      </View>
    </View>
  );
}
