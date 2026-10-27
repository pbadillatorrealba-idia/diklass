import { type InfiniteData, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { Share } from "react-native";
import { useAgendaEvents } from "@/features/agenda/use-agenda-events";
import { type Message, mergeMessages, newMessageId } from "@/features/asistente/chat-model";
import { type ChatDeps, retryTurn, startTurn } from "@/features/asistente/chat-session";
import { useChatStore } from "@/features/asistente/chat-store";
import {
  type Cursor,
  deleteConversation,
  insertMessage,
  type MessagePage,
} from "@/features/asistente/message-service";
import { pacientesDeHoy } from "@/features/asistente/pacientes-de-hoy";
import {
  BasicResponder,
  KnowledgeResponder,
  routeResponder,
} from "@/features/asistente/responders";
import { conversationQueryKey, useConversation } from "@/features/asistente/use-conversation";
import { consultKnowledge } from "@/features/conocimiento/consulta-service";
import { useConversationStore } from "@/features/conocimiento/conversation-store";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * El turno en curso es de la sesión, no de cada instancia del controlador: el chat del panel y el de
 * `/knowledge` comparten la conversación, y «Detener» en uno debe cortar la respuesta del otro.
 */
let activeTurn: AbortController | null = null;

/** «Copiar»: portapapeles en web; en nativo, la hoja de compartir (no hay módulo de portapapeles). */
async function copyText(text: string) {
  if (process.env.EXPO_OS === "web" && globalThis.navigator?.clipboard) {
    await globalThis.navigator.clipboard.writeText(text);
    return;
  }
  await Share.share({ message: text });
}

/**
 * Sesión del chat (asistente-conversacional · design.md D2 · D3 · D12): une la conversación
 * persistida, los mensajes pendientes de la sesión, los respondedores y la persistencia. Vive en el
 * shell, que siempre está montado, para que una respuesta que llega con el panel cerrado se
 * registre y marque el no leído.
 */
export function useChatController() {
  const queryClient = useQueryClient();
  const clinicId = useSessionStore((state) => state.clinicId);
  const veterinarianId = useSessionStore((state) => state.veterinarianId);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const conversation = useConversation();
  const pending = useChatStore((state) => state.pending);
  const unread = useChatStore((state) => state.unread);
  const patientId = useConversationStore((state) => state.patientId);
  const patientName = useConversationStore((state) => state.patientName);
  const events = useAgendaEvents();
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const historyRef = useRef<readonly Message[]>([]);
  historyRef.current = conversation.messages;

  const persist = useCallback(
    async (message: Message) => {
      await insertMessage(supabase, { clinicId: clinicId ?? "", message });
      const key = conversationQueryKey(veterinarianId);
      const cargada = queryClient.getQueryData<InfiniteData<MessagePage, Cursor | undefined>>(key);
      if (!cargada || cargada.pages.length === 0) {
        await queryClient.invalidateQueries({ queryKey: key });
        return;
      }
      queryClient.setQueryData<InfiniteData<MessagePage, Cursor | undefined>>(key, (old) => {
        if (!old) return old;
        const [primera, ...resto] = old.pages;
        if (!primera) return old;
        return {
          ...old,
          pages: [{ ...primera, messages: [...primera.messages, message] }, ...resto],
        };
      });
    },
    [clinicId, queryClient, veterinarianId],
  );

  const deps = useMemo<ChatDeps>(
    () => ({
      responder: routeResponder({
        basico: new BasicResponder({
          now: () => new Date(),
          events: () => eventsRef.current,
          pacientesDeHoy,
        }),
        conocimiento: new KnowledgeResponder({
          consult: (pregunta, patientId) =>
            consultKnowledge(supabase, { clinicId: clinicId ?? "", pregunta, patientId }),
        }),
      }),
      persist,
      store: {
        addPending: (m) => useChatStore.getState().addPending(m),
        setPendingStatus: (id, s) => useChatStore.getState().setPendingStatus(id, s),
        removePending: (id) => useChatStore.getState().removePending(id),
        addUnread: () => useChatStore.getState().addUnread(),
      },
      getPending: () => useChatStore.getState().pending,
      history: () => historyRef.current,
      now: () => new Date(),
      newId: newMessageId,
      isAuthRequired: isAuthenticationRequired,
      onAuthRequired: () => {
        setAccessState("expired");
        openExpiredDialog();
      },
      onError: (error) =>
        void captureClientError(errorReporter, {
          error,
          operation: "asistente_chat",
          requestId: makeRequestId(),
        }),
    }),
    [clinicId, openExpiredDialog, persist, setAccessState],
  );

  const send = useCallback(
    async (text: string) => {
      if (activeTurn) return;
      const controller = new AbortController();
      activeTurn = controller;
      try {
        // El paciente de contexto es el vigente al enviar, no el de cuando llegue la respuesta.
        await startTurn(
          deps,
          { text, patientId: useConversationStore.getState().patientId },
          controller.signal,
        );
      } finally {
        activeTurn = null;
      }
    },
    [deps],
  );

  const retry = useCallback(
    async (messageId: string) => {
      if (activeTurn) return;
      const controller = new AbortController();
      activeTurn = controller;
      try {
        await retryTurn(deps, messageId, controller.signal);
      } finally {
        activeTurn = null;
      }
    },
    [deps],
  );

  const stop = useCallback(() => activeTurn?.abort(), []);

  /** «Borrar conversación»: texto y audio del autor; `knowledge_queries` permanece (FR-020). */
  const clear = useCallback(async () => {
    await deleteConversation(supabase);
    useChatStore.getState().reset();
    await queryClient.invalidateQueries({ queryKey: conversationQueryKey(veterinarianId) });
  }, [queryClient, veterinarianId]);

  const messages = useMemo(
    () => mergeMessages(conversation.messages, pending),
    [conversation.messages, pending],
  );
  const isResponding = pending.some((m) => m.status === "thinking");

  return {
    messages,
    isLoading: conversation.isLoading,
    hasOlder: conversation.hasOlder,
    isLoadingOlder: conversation.isLoadingOlder,
    loadOlder: conversation.loadOlder,
    isResponding,
    /** Paciente de contexto que fija la navegación; `null` sin paciente (etiqueta de solo lectura). */
    context: patientId === null ? null : { name: patientName },
    unread: unread > 0,
    send,
    retry,
    stop,
    clear,
    copy: copyText,
  };
}

export type ChatController = ReturnType<typeof useChatController>;
