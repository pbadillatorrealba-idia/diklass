import { create } from "zustand";
import { canTransition, type Message, type MessageStatus } from "@/features/asistente/chat-model";
import type { Attribution } from "@/lib/attribution/types";
import { queryClient } from "@/lib/query/query-client";
import { useSessionStore } from "@/stores/session-store";

/** Estado de confirmación de una propuesta del agente (solo de la sesión; la idempotencia es del servicio). */
export type ProposalState = {
  busy: boolean;
  confirmedBy: Attribution | null;
  alreadyRecorded: boolean;
  error: string | null;
};

/**
 * Lo efímero del chat (asistente-conversacional · design.md D3 · D12): el borrador de cada hilo, los
 * mensajes que aún no son terminales («enviando», «pensando» o en error sin reintentar) y el contador
 * de no leído. La conversación persistida vive en TanStack Query; esto no sobrevive a la sesión de
 * acceso (Constitución V), como `asistente-store` y `conversation-store`.
 */
export type ChatState = {
  proposals: Record<string, ProposalState>;
  setProposal: (id: string, state: ProposalState) => void;
  drafts: Record<string, string>;
  pending: Message[];
  unread: number;
  setDraft: (threadId: string, text: string) => void;
  addPending: (message: Message) => void;
  /** Aplica la transición solo si el modelo la permite; si no, no hace nada. */
  setPendingStatus: (id: string, status: MessageStatus) => void;
  removePending: (id: string) => void;
  addUnread: () => void;
  clearUnread: () => void;
  reset: () => void;
};

const vacio = (): Pick<ChatState, "drafts" | "pending" | "unread" | "proposals"> => ({
  proposals: {},
  drafts: {},
  pending: [],
  unread: 0,
});

export const useChatStore = create<ChatState>()((set) => ({
  ...vacio(),
  setDraft: (threadId, text) =>
    set((state) => {
      const { [threadId]: _anterior, ...resto } = state.drafts;
      return { drafts: text === "" ? resto : { ...resto, [threadId]: text } };
    }),
  setProposal: (id, state) => set((s) => ({ proposals: { ...s.proposals, [id]: state } })),
  addPending: (message) => set((state) => ({ pending: [...state.pending, message] })),
  setPendingStatus: (id, status) =>
    set((state) => ({
      pending: state.pending.map((message) =>
        message.id === id && canTransition(message.status, status)
          ? { ...message, status }
          : message,
      ),
    })),
  removePending: (id) => set((state) => ({ pending: state.pending.filter((m) => m.id !== id) })),
  addUnread: () => set((state) => ({ unread: state.unread + 1 })),
  clearUnread: () => set({ unread: 0 }),
  reset: () => set(vacio()),
}));

useSessionStore.subscribe((estado, anterior) => {
  if (anterior.accessState === "active" && estado.accessState !== "active") {
    useChatStore.getState().reset();
    // La conversación es privada: no queda en memoria al cerrar la sesión (la clave ya lleva al autor).
    queryClient.removeQueries({ queryKey: ["asistente"] });
  }
});
