import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollView, type ScrollView as ScrollViewHandle, View } from "react-native";
import { MessageItem, type MessageItemProps } from "@/components/asistente/message-item";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import {
  type Anchor,
  diffMessages,
  isNearBottom,
  nextAnchor,
  unseenLabel,
} from "@/features/asistente/anchor";
import type { Message } from "@/features/asistente/chat-model";

export type MessageListProps = Pick<
  MessageItemProps,
  "onCopy" | "onRetry" | "onRemoveAudio" | "onConfirmProposal"
> & {
  /** Cronológicos: los persistidos y, al final, los pendientes de la sesión. */
  messages: readonly Message[];
  isLoading: boolean;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
};

/**
 * Lista de mensajes anclada (asistente-conversacional «Lista de mensajes anclada» y «Accesibilidad de
 * la conversación» · design.md D10): lo más nuevo abajo, anclada al final mientras llegan mensajes,
 * salvo que el veterinario haya subido a leer; entonces no lo arrastra y ofrece «Ir al final» con el
 * conteo de nuevos. Desplazamiento instantáneo. Un solo `ScrollView` para web y nativo (no se
 * virtualiza: son 50 mensajes por página) con la lógica de anclaje pura de `anchor.ts`.
 */
export function MessageList({
  hasOlder,
  isLoading,
  isLoadingOlder,
  messages,
  onLoadOlder,
  ...itemProps
}: MessageListProps) {
  const scroll = useRef<ScrollViewHandle>(null);
  const [anchor, setAnchor] = useState<Anchor>({ pinned: true, unseen: 0 });
  const pinned = useRef(true);
  const viewport = useRef({ y: 0, height: 0, content: 0 });
  const prevIds = useRef<string[]>([]);
  const keepPosition = useRef(false);
  // La carga inicial no se anuncia: la región viva se enciende cuando ya hay contenido.
  const [announce, setAnnounce] = useState(false);

  useEffect(() => {
    if (!isLoading) setAnnounce(true);
  }, [isLoading]);

  const ids = messages.map((message) => message.id);
  // En layout (antes del pintado): la marca de «conservar posición» debe estar puesta cuando el
  // contenido cambie de tamaño, que ocurre antes que un `useEffect`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: depende de los ids, no del arreglo.
  useLayoutEffect(() => {
    const change = diffMessages(prevIds.current, ids);
    prevIds.current = ids;
    if (change.prepended > 0) keepPosition.current = true;
    if (change.appended > 0) {
      // Quien envía un mensaje vuelve al final: lo que acaba de escribir debe verse.
      const propio = messages.slice(-change.appended).some((message) => message.role === "user");
      setAnchor((current) => {
        const next = propio
          ? nextAnchor(current, { nearBottom: true })
          : nextAnchor(current, { appended: change.appended });
        pinned.current = next.pinned;
        return next;
      });
    }
  }, [ids.join("|")]);

  const goToEnd = () => {
    scroll.current?.scrollToEnd({ animated: false });
    pinned.current = true;
    setAnchor({ pinned: true, unseen: 0 });
  };

  return (
    <View className="relative flex-1">
      <ScrollView
        aria-label="Conversación con el asistente"
        aria-live={announce ? "polite" : "off"}
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        onContentSizeChange={(_width, height) => {
          const { content, y } = viewport.current;
          viewport.current.content = height;
          if (keepPosition.current) {
            // «Cargar anteriores»: la vista conserva lo que leía, el contenido nuevo queda arriba.
            keepPosition.current = false;
            scroll.current?.scrollTo({ y: y + (height - content), animated: false });
          } else if (pinned.current) {
            scroll.current?.scrollToEnd({ animated: false });
          }
        }}
        onLayout={(event) => {
          viewport.current.height = event.nativeEvent.layout.height;
        }}
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          viewport.current.y = contentOffset.y;
          const near = isNearBottom({
            scrollTop: contentOffset.y,
            clientHeight: layoutMeasurement.height,
            scrollHeight: contentSize.height,
          });
          pinned.current = near;
          setAnchor((current) => nextAnchor(current, { nearBottom: near }));
        }}
        ref={scroll}
        role="log"
        scrollEventThrottle={50}
        testID="message-list"
      >
        {hasOlder ? (
          <Button
            className="self-center"
            isDisabled={isLoadingOlder}
            onPress={onLoadOlder}
            size="sm"
            testID="load-older"
            variant="outline"
          >
            <ButtonText>{isLoadingOlder ? "Cargando…" : "Cargar anteriores"}</ButtonText>
          </Button>
        ) : null}
        {messages.length === 0 && !isLoading ? (
          <Text tone="muted">Aún no hay mensajes. Escribe tu primera pregunta.</Text>
        ) : null}
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} {...itemProps} />
        ))}
      </ScrollView>
      {anchor.unseen > 0 ? (
        <View className="absolute bottom-2 self-center" testID="go-to-end">
          <Button onPress={goToEnd} size="sm" variant="outline">
            <ButtonText>{`Ir al final · ${unseenLabel(anchor.unseen)}`}</ButtonText>
          </Button>
        </View>
      ) : null}
    </View>
  );
}
