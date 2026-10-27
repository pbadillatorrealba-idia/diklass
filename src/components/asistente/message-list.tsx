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
  planScroll,
  unseenLabel,
} from "@/features/asistente/anchor";
import type { Message } from "@/features/asistente/chat-model";
import { nextStatusText } from "@/features/asistente/live-status";

export type MessageListProps = Pick<
  MessageItemProps,
  "onCopy" | "onRetry" | "onRemoveAudio" | "onConfirmProposal" | "onPlayAudio"
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
  // Última medida de nativo (`onScroll`/`onLayout`) y alto del contenido antes del último cambio.
  const viewport = useRef({ y: 0, height: 0, content: 0 });
  const prevIds = useRef<string[]>([]);
  const keepPosition = useRef(false);
  const forceEnd = useRef(false);
  // La carga inicial no se anuncia: la región viva se enciende cuando ya hay contenido.
  const [announce, setAnnounce] = useState(false);

  useEffect(() => {
    if (!isLoading) setAnnounce(true);
  }, [isLoading]);

  // «Cargar anteriores» antepone hasta 50 mensajes: no se anuncian (no son mensajes nuevos). La región
  // se apaga al pedirlos y vuelve poco después de que lleguen.
  const [quiet, setQuiet] = useState(false);
  useEffect(() => {
    if (!quiet || isLoadingOlder) return;
    const id = setTimeout(() => setQuiet(false), 600);
    return () => clearTimeout(id);
  }, [quiet, isLoadingOlder]);

  // Región de estado aparte de la lista: «Pensando…» y «Respuesta lista», una sola vez.
  const thinking = messages.some((message) => message.status === "thinking");
  const last = messages.at(-1);
  const finished = last?.role === "assistant" && last.status === "done";
  const [statusText, setStatusText] = useState("");
  const wasThinking = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo reacciona al cambio de `thinking`.
  useEffect(() => {
    const next = nextStatusText(wasThinking.current, thinking, finished);
    wasThinking.current = thinking;
    if (next !== null) setStatusText(next);
  }, [thinking]);
  useEffect(() => {
    if (statusText !== "Respuesta lista") return;
    const id = setTimeout(() => setStatusText(""), 4000);
    return () => clearTimeout(id);
  }, [statusText]);

  /** Posición real de la vista: en web, del propio nodo (RNW no emite todos los eventos de scroll). */
  const live = () => {
    const node = (
      scroll.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null
    )?.getScrollableNode?.();
    return node
      ? { y: node.scrollTop, height: node.clientHeight }
      : { y: viewport.current.y, height: viewport.current.height };
  };

  const ids = messages.map((message) => message.id);
  // En layout (antes del pintado): las marcas de «conservar posición» y «ir al final» deben estar
  // puestas cuando el contenido cambie de tamaño, que ocurre antes que un `useEffect`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: depende de los ids, no del arreglo.
  useLayoutEffect(() => {
    const change = diffMessages(prevIds.current, ids);
    prevIds.current = ids;
    if (change.prepended > 0) keepPosition.current = true;
    if (change.appended > 0) {
      // Quien envía un mensaje vuelve al final: lo que acaba de escribir debe verse.
      const propio = messages.slice(-change.appended).some((message) => message.role === "user");
      const { y, height } = live();
      const abajo = isNearBottom({
        scrollTop: y,
        clientHeight: height,
        scrollHeight: viewport.current.content,
      });
      if (propio) forceEnd.current = true;
      setAnchor((current) =>
        propio || abajo
          ? nextAnchor(current, { nearBottom: true })
          : nextAnchor(nextAnchor(current, { nearBottom: false }), { appended: change.appended }),
      );
    }
  }, [ids.join("|")]);

  const goToEnd = () => {
    scroll.current?.scrollToEnd({ animated: false });
    setAnchor({ pinned: true, unseen: 0 });
  };

  return (
    <View className="relative flex-1">
      <ScrollView
        aria-label="Conversación con el asistente"
        aria-live={announce && !quiet ? "polite" : "off"}
        className="flex-1"
        contentContainerClassName="gap-4 p-4"
        onContentSizeChange={(_width, height) => {
          const { y, height: client } = live();
          const plan = planScroll({
            y,
            height: client,
            prevContent: viewport.current.content,
            nextContent: height,
            keepPosition: keepPosition.current,
            forceEnd: forceEnd.current,
          });
          keepPosition.current = false;
          forceEnd.current = false;
          viewport.current.content = height;
          if (plan === null) return;
          if (plan.to === "end") scroll.current?.scrollToEnd({ animated: false });
          else scroll.current?.scrollTo({ y: plan.to, animated: false });
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
          setAnchor((current) => nextAnchor(current, { nearBottom: near }));
        }}
        ref={scroll}
        role="log"
        // Un cuadro: iOS solo emite un evento por gesto con 0, y RNW solo emite ticks con un valor > 0.
        scrollEventThrottle={16}
        testID="message-list"
      >
        {hasOlder ? (
          <Button
            className="self-center"
            isDisabled={isLoadingOlder}
            onPress={() => {
              setQuiet(true);
              onLoadOlder();
            }}
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
      {/* Existe siempre y se rellena: así el lector anuncia el cambio. Solo para lectores. */}
      <View
        aria-live="polite"
        role="status"
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 }}
        testID="chat-status"
      >
        <Text>{statusText}</Text>
      </View>
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
