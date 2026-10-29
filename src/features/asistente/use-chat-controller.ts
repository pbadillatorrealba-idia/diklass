import { type InfiniteData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import { Share } from "react-native";
import { useAgendaEvents } from "@/features/agenda/use-agenda-events";
import { invokeAgent } from "@/features/asistente/agent-service";
import {
  type Message,
  mergeMessages,
  newMessageId,
  type Part,
} from "@/features/asistente/chat-model";
import {
  type ChatDeps,
  retryTurn,
  startTurn,
  startTurnWithMessage,
} from "@/features/asistente/chat-session";
import { useChatStore } from "@/features/asistente/chat-store";
import {
  type Cursor,
  deleteConversation,
  insertMessage,
  type MessagePage,
} from "@/features/asistente/message-service";
import { pacientesDeHoy } from "@/features/asistente/pacientes-de-hoy";
import { executeProposal } from "@/features/asistente/proposal-action";
import {
  AgentResponder,
  BasicResponder,
  KnowledgeResponder,
  routeAgent,
  routeResponder,
} from "@/features/asistente/responders";
import { createTurnGate } from "@/features/asistente/turn-gate";
import { conversationQueryKey, useConversation } from "@/features/asistente/use-conversation";
import { useVoiceMessage } from "@/features/asistente/use-voice-message";
import { acceptVoiceConsent, hasVoiceConsent } from "@/features/asistente/voice-consent";
import {
  borrarAudioChat,
  firmarAudioChat,
  quitarAudio,
  rutaAudioChat,
  rutasDeAudio,
  subirAudioChat,
  transcribirAudioChat,
} from "@/features/asistente/voice-message-service";
import { consultKnowledge } from "@/features/conocimiento/consulta-service";
import { useConversationStore } from "@/features/conocimiento/conversation-store";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/** El turno en curso es de la sesión, no de cada instancia del controlador (ver `turn-gate.ts`). */
const gate = createTurnGate();

/**
 * «Copiar»: portapapeles en web; en nativo, la hoja de compartir (no hay módulo de portapapeles).
 * Devuelve si se pudo, para avisarlo.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (process.env.EXPO_OS === "web" && globalThis.navigator?.clipboard) {
      await globalThis.navigator.clipboard.writeText(text);
    } else {
      await Share.share({ message: text });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sesión del chat (asistente-conversacional · design.md D2 · D3 · D12): une la conversación
 * persistida, los mensajes pendientes de la sesión, los respondedores y la persistencia. Vive en el
 * shell, que siempre está montado, para que una respuesta que llega con el panel cerrado se
 * registre y marque el no leído.
 */
/** Bandera de entrega del agente: `EXPO_PUBLIC_AGENT=1` en el entorno de la app. */
const AGENT_ENABLED = process.env.EXPO_PUBLIC_AGENT === "1";

export function useChatController() {
  const router = useRouter();
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
  const voice = useVoiceMessage();
  // Consentimiento de la primera grabación (el audio va a un proveedor externo). La clave empieza por
  // «asistente»: se elimina de la caché al cerrar sesión.
  const consent = useQuery({
    enabled: veterinarianId !== null,
    queryFn: () => hasVoiceConsent(supabase),
    queryKey: ["asistente", "voz-consentimiento", veterinarianId],
    // Sin reintento automático: un error se dice y el usuario reintenta él (no se queda «cargando»).
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const acceptConsent = useCallback(async () => {
    await acceptVoiceConsent(supabase);
    queryClient.setQueryData(["asistente", "voz-consentimiento", veterinarianId], true);
  }, [queryClient, veterinarianId]);
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

  // Respuestas ya obtenidas por pregunta: sobreviven a re-renders para reutilizarlas al reintentar.
  const answers = useRef(new Map<string, Part[]>()).current;

  const deps = useMemo<ChatDeps>(
    () => ({
      responder: (() => {
        const basico = new BasicResponder({
          now: () => new Date(),
          events: () => eventsRef.current,
          pacientesDeHoy,
        });
        // Agente LangChain tras bandera: sin ella, el flujo de conocimiento de siempre.
        if (AGENT_ENABLED) {
          return routeAgent({
            basico,
            agente: new AgentResponder({
              invoke: (body) => invokeAgent(supabase, body),
              navigate: (path) => router.push(path as never),
            }),
          });
        }
        return routeResponder({
          basico,
          conocimiento: new KnowledgeResponder({
            consult: (pregunta, patientId) =>
              consultKnowledge(supabase, { clinicId: clinicId ?? "", pregunta, patientId }),
          }),
        });
      })(),
      persist,
      store: {
        addPending: (m) => useChatStore.getState().addPending(m),
        setPendingStatus: (id, s) => useChatStore.getState().setPendingStatus(id, s),
        removePending: (id) => useChatStore.getState().removePending(id),
        addUnread: () => useChatStore.getState().addUnread(),
      },
      getPending: () => useChatStore.getState().pending,
      answers,
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
    [answers, clinicId, openExpiredDialog, persist, router, setAccessState],
  );

  /** Una escritura de un turno ya invalidado (conversación borrada) no se hace. */
  const guarded = useCallback(
    (turn: { isCurrent: () => boolean }): ChatDeps => ({
      ...deps,
      persist: (message) => (turn.isCurrent() ? deps.persist(message) : Promise.resolve()),
    }),
    [deps],
  );

  /** Devuelve si el envío se aceptó: con un turno en curso o sin sesión lista no se acepta. */
  const send = useCallback(
    (text: string): boolean => {
      const turn = clinicId ? gate.begin() : null;
      if (!turn) return false;
      // El paciente de contexto es el vigente al enviar, no el de cuando llegue la respuesta.
      void startTurn(
        guarded(turn),
        { text, patientId: useConversationStore.getState().patientId },
        turn.signal,
      ).finally(turn.end);
      return true;
    },
    [clinicId, guarded],
  );

  const retry = useCallback(
    (messageId: string): boolean => {
      const turn = clinicId ? gate.begin() : null;
      if (!turn) return false;
      void retryTurn(guarded(turn), messageId, turn.signal).finally(turn.end);
      return true;
    },
    [clinicId, guarded],
  );

  const stop = useCallback(() => gate.abort(), []);

  /** «Borrar conversación»: texto y audio del autor; `knowledge_queries` permanece (FR-020). */
  const clear = useCallback(async () => {
    // Un turno en vuelo no puede «resucitar» la conversación escribiendo tras el borrado.
    gate.invalidate();
    // El audio es dato clínico: se borra de Storage antes que las filas (de mejor esfuerzo; la purga
    // programada barre lo que quede sin referencia).
    await borrarAudioChat(supabase, await rutasDeAudio(supabase).catch(() => []));
    await deleteConversation(supabase);
    useChatStore.getState().reset();
    await queryClient.invalidateQueries({ queryKey: conversationQueryKey(veterinarianId) });
  }, [queryClient, veterinarianId]);

  /**
   * Enviar el audio en revisión (tarea 7.5): subir → transcribir → un único mensaje de voz con su
   * transcripción como pregunta. Si la transcripción es insuficiente se avisa y no se responde; si algo
   * falla se vuelve a la revisión con el mismo audio para reintentar.
   */
  const sendVoice = useCallback(async (): Promise<boolean> => {
    const turn = clinicId && veterinarianId ? gate.begin() : null;
    if (!turn) {
      // Hay una respuesta en curso: el audio sigue en revisión y se avisa, no se pierde en silencio.
      voice.showNotice("busy");
      return false;
    }
    const envio = voice.beginSend();
    if (!envio || !clinicId || !veterinarianId) {
      turn.end();
      return false;
    }
    const id = newMessageId();
    const path = rutaAudioChat(clinicId, veterinarianId, id, envio.payload.extension);
    let subido = false;
    try {
      await subirAudioChat(supabase, path, envio.payload);
      subido = true;
      const { text, quality } = await transcribirAudioChat(supabase, envio.payload);
      if (quality === "insufficient" || text.trim() === "") {
        await borrarAudioChat(supabase, [path]);
        voice.sendDone();
        voice.showNotice("not-understood");
        turn.end();
        return true;
      }
      voice.sendDone();
      void startTurnWithMessage(
        guarded(turn),
        {
          id,
          role: "user",
          createdAt: new Date().toISOString(),
          status: "sending",
          patientId: useConversationStore.getState().patientId,
          parts: [
            {
              type: "audio",
              durationMs: envio.durationMs,
              transcript: text.trim(),
              audioPath: path,
              audioState: "ready",
            },
          ],
        },
        turn.signal,
      ).finally(turn.end);
      return true;
    } catch (error) {
      if (subido) await borrarAudioChat(supabase, [path]);
      voice.sendFailed();
      turn.end();
      if (deps.isAuthRequired(error)) deps.onAuthRequired();
      else deps.onError(error);
      return true;
    }
  }, [clinicId, deps, guarded, veterinarianId, voice]);

  /** «Eliminar audio»: la transcripción permanece; el mensaje en pantalla pasa a «audio eliminado». */
  const removeAudio = useCallback(
    async (messageId: string) => {
      try {
        if (!(await quitarAudio(supabase, messageId))) return;
      } catch (error) {
        deps.onError(error);
        return;
      }
      const key = conversationQueryKey(veterinarianId);
      queryClient.setQueryData<InfiniteData<MessagePage, Cursor | undefined>>(key, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                messages: page.messages.map((m) =>
                  m.id === messageId
                    ? {
                        ...m,
                        parts: m.parts.map((part) =>
                          part.type === "audio"
                            ? { ...part, audioState: "deleted" as const, audioPath: null }
                            : part,
                        ),
                      }
                    : m,
                ),
              })),
            }
          : old,
      );
    },
    [deps, queryClient, veterinarianId],
  );

  /** URL firmada para reproducir un audio vigente; `null` si ya venció. */
  const playAudio = useCallback((path: string) => firmarAudioChat(supabase, path), []);

  const messages = useMemo(
    () => mergeMessages(conversation.messages, pending),
    [conversation.messages, pending],
  );
  const isResponding = pending.some((m) => m.status === "thinking");

  const proposals = useChatStore((s) => s.proposals);
  /**
   * Confirmar una propuesta del agente: la única escritura del agente, con la misma validación que la
   * UI manual. Un fallo no escribe nada y deja «Confirmar» disponible con el motivo.
   */
  const confirmProposal = useCallback(
    async (proposalId: string) => {
      const proposal = messages
        .flatMap((m) => m.parts)
        .flatMap((p) => (p.type === "proposal" ? [p.proposal] : []))
        .find((p) => p.id === proposalId);
      const { setProposal } = useChatStore.getState();
      if (!proposal?.action || !clinicId || useChatStore.getState().proposals[proposalId]?.busy) {
        return;
      }
      const base = { busy: false, confirmedBy: null, alreadyRecorded: false, error: null };
      setProposal(proposalId, { ...base, busy: true });
      try {
        const { attribution } = await executeProposal(supabase, clinicId, proposal.action);
        setProposal(proposalId, {
          ...base,
          confirmedBy: attribution,
          alreadyRecorded: !attribution,
        });
      } catch (error) {
        if (isAuthenticationRequired(error)) {
          setAccessState("expired");
          openExpiredDialog();
        }
        void captureClientError(errorReporter, {
          error,
          operation: "asistente_confirmar_propuesta",
          requestId: makeRequestId(),
        });
        setProposal(proposalId, { ...base, error: "No se pudo guardar. No se registró nada." });
      }
    },
    [clinicId, messages, openExpiredDialog, setAccessState],
  );

  return {
    messages,
    confirmProposal,
    proposalState: (id: string) => proposals[id],
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
    voice,
    voiceConsent: {
      // Un error de carga es un estado propio (con reintento): tratarlo como «needed» dejaba al usuario
      // en un bucle de aviso que no puede resolver.
      status: (consent.data === true
        ? "accepted"
        : consent.isError
          ? "error"
          : consent.isLoading
            ? "loading"
            : "needed") as "accepted" | "error" | "loading" | "needed",
      accept: acceptConsent,
      retry: () => void consent.refetch(),
    },
    sendVoice,
    removeAudio,
    playAudio,
  };
}

export type ChatController = ReturnType<typeof useChatController>;
