import { View } from "react-native";
import { PartView } from "@/components/asistente/message-parts";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { type Message, messageText } from "@/features/asistente/chat-model";

const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export type MessageItemProps = {
  message: Message;
  onCopy?: (text: string) => void;
  onRetry?: (messageId: string) => void;
  onRemoveAudio?: (messageId: string) => void;
  onConfirmProposal?: (proposalId: string) => void;
  onPlayAudio?: (path: string) => Promise<string | null>;
};

/**
 * Un mensaje del chat (asistente-conversacional «Mensajes del chat» y «Acciones del mensaje» ·
 * design.md D11). El veterinario va a la derecha en un bloque `primary-surface` y el asistente sin
 * caja, con el rótulo «Asistente · hora»: se distinguen por alineación y rótulo, no solo por color.
 * Sin burbujas (`rounded-sm`). No ofrece editar ni regenerar.
 */
export function MessageItem({
  message,
  onCopy,
  onConfirmProposal,
  onPlayAudio,
  onRemoveAudio,
  onRetry,
}: MessageItemProps) {
  const esUsuario = message.role === "user";
  const rotulo = `${esUsuario ? "Tú" : "Asistente"} · ${hora(message.createdAt)}`;
  const texto = messageText(message);
  const terminal = message.status === "done" || message.status === "error";
  const audioVigente = message.parts.some(
    (part) => part.type === "audio" && part.audioState === "ready",
  );

  return (
    <View
      aria-label={rotulo}
      className={esUsuario ? "self-end rounded-sm bg-primary-surface px-3 py-2" : "gap-2"}
      role="article"
      style={esUsuario ? { maxWidth: "85%" } : undefined}
      testID={`message-${message.role}`}
    >
      <Text
        className={esUsuario ? "self-end" : ""}
        tone="muted"
        variant={esUsuario ? "caption" : "rubric"}
      >
        {rotulo}
      </Text>
      <View className="gap-2">
        {message.parts.map((part, index) => (
          <PartView
            ctx={{ role: message.role, onConfirmProposal, onPlayAudio }}
            // biome-ignore lint/suspicious/noArrayIndexKey: las partes de un mensaje no traen id y su orden es fijo
            key={`${part.type}-${index}`}
            part={part}
          />
        ))}
      </View>
      {message.status === "thinking" ? (
        // Solo visual: la región de estado de la lista lo anuncia una vez («Pensando…»).
        <View aria-hidden>
          <Text tone="muted">Pensando…</Text>
        </View>
      ) : null}
      {message.status === "sending" ? (
        <Text tone="muted" variant="caption">
          Enviando…
        </Text>
      ) : null}
      {message.status === "error" ? (
        <Text role="alert" tone="destructive" variant="caption">
          No se pudo completar.
        </Text>
      ) : null}
      {terminal ? (
        // Las acciones del asistente se alinean con su texto (el botón fantasma lleva 12 px de relleno).
        <View className={`flex-row flex-wrap gap-1 ${esUsuario ? "" : "-ml-3"}`.trim()}>
          {onCopy && texto !== "" ? (
            <Button onPress={() => onCopy(texto)} size="sm" testID="message-copy" variant="ghost">
              <ButtonText>Copiar</ButtonText>
            </Button>
          ) : null}
          {message.status === "error" && onRetry ? (
            <Button
              onPress={() => onRetry(message.id)}
              size="sm"
              testID="message-retry"
              variant="outline"
            >
              <ButtonText>Reintentar</ButtonText>
            </Button>
          ) : null}
          {audioVigente && onRemoveAudio ? (
            <Button
              onPress={() => onRemoveAudio(message.id)}
              size="sm"
              testID="message-remove-audio"
              variant="ghost"
            >
              <ButtonText>Eliminar audio</ButtonText>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
