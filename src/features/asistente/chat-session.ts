import type { Message, MessageStatus, Part } from "@/features/asistente/chat-model";
import type { Responder } from "@/features/asistente/responders";

/**
 * Un turno del chat (asistente-conversacional «Mensajes del chat», «Acciones del mensaje» y «Composer
 * del chat» · design.md D2 · D3): la pregunta pasa por «enviando» y «pensando» en la sesión y, solo
 * cuando es terminal, se persiste junto con la respuesta. Las dependencias entran por parámetro para
 * probarlo sin red.
 */
export type ChatDeps = {
  responder: Responder;
  /** Persiste un mensaje terminal (y lo suma a la conversación cargada). */
  persist: (message: Message) => Promise<void>;
  store: {
    addPending: (message: Message) => void;
    setPendingStatus: (id: string, status: MessageStatus) => void;
    removePending: (id: string) => void;
    addUnread: () => void;
  };
  /** Se avisa cuando la respuesta del asistente quedó guardada (p. ej. para locutarla). */
  onAnswer?: (parts: Part[]) => void;
  getPending: () => readonly Message[];
  /**
   * Respuestas ya obtenidas por pregunta (id): si persistir falla y se reintenta, no se vuelve a
   * consultar (una consulta de conocimiento duplicaría su fila de auditoría, FR-020).
   */
  answers: Map<string, Part[]>;
  history: () => readonly Message[];
  now: () => Date;
  newId: () => string;
  isAuthRequired: (error: unknown) => boolean;
  onAuthRequired: () => void;
  onError: (error: unknown) => void;
};

/** Lo que se le pregunta al asistente: el texto escrito o la transcripción del audio. */
const textOf = (message: Message) =>
  message.parts
    .flatMap((part) =>
      part.type === "text" ? [part.text] : part.type === "audio" ? [part.transcript] : [],
    )
    .join("\n");

/** Resuelve `"aborted"` cuando se pulsa «Detener», sin esperar a la red. */
function whenAborted(signal: AbortSignal): Promise<"aborted"> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve("aborted");
    else signal.addEventListener("abort", () => resolve("aborted"), { once: true });
  });
}

async function run(deps: ChatDeps, user: Message, signal: AbortSignal) {
  const { store } = deps;
  const placeholderId = `${user.id}:respuesta`;
  store.removePending(placeholderId);
  store.addPending({
    id: placeholderId,
    role: "assistant",
    createdAt: deps.now().toISOString(),
    status: "thinking",
    patientId: user.patientId,
    parts: [],
  });
  let userPersisted = false;
  try {
    // La respuesta ya obtenida en un intento anterior se reutiliza: no se vuelve a consultar.
    let parts: Part[] | null = deps.answers.get(user.id) ?? null;
    if (parts === null) {
      const obtener = (async () => {
        let ready: Part[] | null = null;
        for await (const event of deps.responder.respond(
          deps.history(),
          { text: textOf(user), patientId: user.patientId },
          signal,
        )) {
          if (event.type === "ready") ready = event.parts;
        }
        return ready;
      })();
      // «Detener» corta al instante, aunque la red tarde: la consulta ya lanzada sigue auditada, pero
      // su respuesta (o su fallo) tardíos se descartan.
      const primero = await Promise.race([obtener, whenAborted(signal)]);
      if (primero === "aborted") {
        obtener.catch(() => {});
        store.removePending(placeholderId);
        await deps.persist({ ...user, status: "done" });
        store.removePending(user.id);
        return;
      }
      parts = primero;
      if (parts !== null) deps.answers.set(user.id, parts);
    }
    // El marcador «Pensando…» sigue hasta terminar de persistir: así el composer sigue en
    // «Detener» y no acepta un envío que se perdería mientras se hacen los INSERT.
    await deps.persist({ ...user, status: "done" });
    userPersisted = true;
    // «Detener»: la pregunta se conserva y la respuesta parcial se descarta (no se persiste).
    if (signal.aborted || parts === null) {
      store.removePending(placeholderId);
      store.removePending(user.id);
      deps.answers.delete(user.id);
      return;
    }
    await deps.persist({
      id: deps.newId(),
      role: "assistant",
      createdAt: deps.now().toISOString(),
      status: "done",
      patientId: user.patientId,
      parts,
    });
    deps.answers.delete(user.id);
    store.removePending(placeholderId);
    store.removePending(user.id);
    store.addUnread();
    deps.onAnswer?.(parts);
  } catch (error) {
    store.removePending(placeholderId);
    if (deps.isAuthRequired(error)) {
      store.removePending(user.id);
      deps.answers.delete(user.id);
      deps.onAuthRequired();
      return;
    }
    deps.onError(error);
    if (userPersisted) {
      // La pregunta ya está guardada: reintentarla la duplicaría. Se avisa de la respuesta perdida.
      store.removePending(user.id);
      deps.answers.delete(user.id);
      store.addPending({
        id: `${user.id}:error`,
        role: "assistant",
        createdAt: deps.now().toISOString(),
        status: "error",
        patientId: user.patientId,
        parts: [{ type: "notice", text: "No se pudo guardar la respuesta. Vuelve a preguntar." }],
      });
    } else {
      store.setPendingStatus(user.id, "error");
    }
  }
}

export async function startTurn(
  deps: ChatDeps,
  input: { text: string; patientId: string | null },
  signal: AbortSignal,
) {
  await startTurnWithMessage(
    deps,
    {
      id: deps.newId(),
      role: "user",
      createdAt: deps.now().toISOString(),
      status: "sending",
      patientId: input.patientId,
      parts: [{ type: "text", text: input.text }],
    },
    signal,
  );
}

/** Un turno con un mensaje ya armado (p. ej. de voz: parte de audio con su transcripción). */
export async function startTurnWithMessage(deps: ChatDeps, user: Message, signal: AbortSignal) {
  deps.store.addPending(user);
  await run(deps, user, signal);
}

/** «Reintentar»: reenvía la misma pregunta (mismo id) sin duplicarla en la conversación. */
export async function retryTurn(deps: ChatDeps, messageId: string, signal: AbortSignal) {
  const user = deps.getPending().find((m) => m.id === messageId);
  if (user?.role !== "user" || user.status !== "error") return;
  deps.store.setPendingStatus(messageId, "sending");
  await run(deps, { ...user, status: "sending" }, signal);
}
