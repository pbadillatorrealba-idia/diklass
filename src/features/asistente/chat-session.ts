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
  getPending: () => readonly Message[];
  history: () => readonly Message[];
  now: () => Date;
  newId: () => string;
  isAuthRequired: (error: unknown) => boolean;
  onAuthRequired: () => void;
  onError: (error: unknown) => void;
};

const textOf = (message: Message) =>
  message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");

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
    let parts: Part[] | null = null;
    for await (const event of deps.responder.respond(
      deps.history(),
      { text: textOf(user), patientId: user.patientId },
      signal,
    )) {
      if (event.type === "ready") parts = event.parts;
    }
    store.removePending(placeholderId);
    await deps.persist({ ...user, status: "done" });
    userPersisted = true;
    // «Detener»: la pregunta se conserva y la respuesta parcial se descarta (no se persiste).
    if (signal.aborted || parts === null) {
      store.removePending(user.id);
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
    store.removePending(user.id);
    store.addUnread();
  } catch (error) {
    store.removePending(placeholderId);
    if (deps.isAuthRequired(error)) {
      store.removePending(user.id);
      deps.onAuthRequired();
      return;
    }
    deps.onError(error);
    if (userPersisted) {
      // La pregunta ya está guardada: reintentarla la duplicaría. Se avisa de la respuesta perdida.
      store.removePending(user.id);
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
  const user: Message = {
    id: deps.newId(),
    role: "user",
    createdAt: deps.now().toISOString(),
    status: "sending",
    patientId: input.patientId,
    parts: [{ type: "text", text: input.text }],
  };
  deps.store.addPending(user);
  await run(deps, user, signal);
}

/** «Reintentar»: reenvía la misma pregunta (mismo id) sin duplicarla en la conversación. */
export async function retryTurn(deps: ChatDeps, messageId: string, signal: AbortSignal) {
  const user = deps.getPending().find((m) => m.id === messageId);
  if (!user || user.role !== "user" || user.status !== "error") return;
  deps.store.setPendingStatus(messageId, "sending");
  await run(deps, { ...user, status: "sending" }, signal);
}
