import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Composer } from "@/components/asistente/composer";
import { MessageList } from "@/components/asistente/message-list";
import { VoiceButton, VoiceConsentDialog, VoicePanel } from "@/components/asistente/voice-controls";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useChatStore } from "@/features/asistente/chat-store";
import { restoreFocus } from "@/features/asistente/restore-focus";
import type { ChatController } from "@/features/asistente/use-chat-controller";

const SUGERENCIAS = [
  "¿Qué día es hoy?",
  "¿Qué eventos tengo agendados?",
  "¿Cuáles son los pacientes de hoy?",
] as const;

const THREAD_ID = "asistente";

const asHtml = (node: View | null) => node as unknown as HTMLElement | null;

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
  // «Eliminar audio» pide confirmación (asistente-conversacional «Conservación del audio por 90 días»).
  const [audioToRemove, setAudioToRemove] = useState<string | null>(null);
  // Aviso de primer uso: se pide antes de la primera grabación (el audio va a un proveedor externo).
  const [consentOpen, setConsentOpen] = useState(false);
  const recordRef = useRef<View>(null);
  const empezarVoz = () => {
    const { status, retry } = chat.voiceConsent;
    if (status === "accepted") void chat.voice.start();
    else if (status === "needed") setConsentOpen(true);
    else if (status === "error") {
      setStatus(
        "No se pudo comprobar tu aceptación del aviso de voz. Se está reintentando; vuelve a intentarlo.",
      );
      retry();
    }
  };
  const cancelarAviso = () => {
    setConsentOpen(false);
    // El diálogo se desmonta: el foco vuelve al botón de grabar (el escenario «rechazar el aviso»).
    restoreFocus(() => asHtml(recordRef.current));
  };
  const aceptarVoz = async () => {
    try {
      await chat.voiceConsent.accept();
      setConsentOpen(false);
      void chat.voice.start();
    } catch {
      setStatus("No se pudo registrar tu aceptación. Inténtalo de nuevo.");
    }
  };
  // Foco de la confirmación (acción destructiva): entra en «Cancelar» y vuelve al disparador al cerrar.
  const clearRef = useRef<View>(null);
  const cancelRef = useRef<View>(null);
  useEffect(() => {
    if (confirming) asHtml(cancelRef.current)?.focus?.({ preventScroll: true });
  }, [confirming]);
  const cancelarBorrado = () => {
    setConfirming(false);
    restoreFocus(() => asHtml(clearRef.current));
  };
  const [status, setStatus] = useState<string | null>(null);
  // Aviso breve de «Copiar»: una región de estado que existe siempre y se rellena (se anuncia).
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (notice === "") return;
    const id = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: se repite con cada mensaje que llega.
  useEffect(() => {
    clearUnread();
  }, [chat.messages.length, clearUnread]);

  const copiar = async (text: string) => {
    setNotice((await chat.copy(text)) ? "Copiado al portapapeles." : "No se pudo copiar.");
  };

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
          <Button
            onPress={() => setConfirming(true)}
            ref={clearRef}
            size="sm"
            testID="chat-clear"
            variant="ghost"
          >
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
          aria-label="Confirmar el borrado de la conversación"
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
              onPress={cancelarBorrado}
              ref={cancelRef}
              size="sm"
              testID="chat-clear-no"
              variant="outline"
            >
              <ButtonText>Cancelar</ButtonText>
            </Button>
          </View>
        </View>
      ) : null}
      <View aria-live="polite" role="status">
        {notice !== "" ? (
          <Text className="px-3 pt-2" tone="muted" variant="caption">
            {notice}
          </Text>
        ) : null}
      </View>
      {audioToRemove !== null ? (
        <View
          aria-label="Confirmar la eliminación del audio"
          className="mx-3 mt-2 gap-2 rounded-sm border border-border bg-card p-3"
          role="alertdialog"
          testID="audio-remove-confirm"
        >
          <Text>Se eliminará el audio de este mensaje. Su transcripción permanece como texto.</Text>
          <View className="flex-row gap-2">
            <Button
              onPress={() => {
                const id = audioToRemove;
                setAudioToRemove(null);
                void chat.removeAudio(id);
              }}
              size="sm"
              testID="audio-remove-yes"
              variant="destructive"
            >
              <ButtonText>Eliminar audio</ButtonText>
            </Button>
            <Button
              onPress={() => setAudioToRemove(null)}
              size="sm"
              testID="audio-remove-no"
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
              onPress={() => chat.send(sugerencia)}
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
        onCopy={(text) => void copiar(text)}
        onLoadOlder={() => void chat.loadOlder()}
        onPlayAudio={chat.playAudio}
        onRemoveAudio={(id) => setAudioToRemove(id)}
        onRetry={(id) => chat.retry(id)}
      />

      <View className="gap-2 border-t border-border p-3">
        {consentOpen ? (
          <VoiceConsentDialog onAccept={() => void aceptarVoz()} onCancel={cancelarAviso} />
        ) : null}
        <VoicePanel onSend={() => void chat.sendVoice()} voice={chat.voice} />
        <Composer
          actions={<VoiceButton buttonRef={recordRef} onPress={empezarVoz} voice={chat.voice} />}
          isResponding={chat.isResponding}
          onChangeText={(text) => setDraft(THREAD_ID, text)}
          onSend={(text) => {
            // Solo se vacía el borrador si el envío se aceptó: si no, el texto no se pierde.
            if (chat.send(text)) setDraft(THREAD_ID, "");
          }}
          onStop={chat.stop}
          value={draft}
        />
      </View>
    </View>
  );
}
