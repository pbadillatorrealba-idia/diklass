import { create } from "zustand";
import { useSessionStore } from "@/stores/session-store";

/**
 * Paciente de contexto del chat durante la sesión de acceso (FR-026 · US5-AC4 · chat-del-asistente
 * D8): lo fija la navegación (ficha o consulta) y no un selector. Los turnos de la conversación viven
 * en `assistant_messages` y cada consulta de conocimiento se registra aparte en `knowledge_queries`
 * para la reconstrucción (FR-020).
 */

export type ConversationState = {
  patientId: string | null;
  /** Nombre para la etiqueta «Contexto: nombre»; lo da la pantalla, que ya lo tiene cargado. */
  patientName: string | null;
  /** Quién fijó el contexto: al salir solo limpia quien lo fijó (último en montar gana). */
  owner: string | null;
  setPatient: (
    patientId: string | null,
    patientName?: string | null,
    owner?: string | null,
  ) => void;
  /** Suelta el contexto solo si lo fijó `owner`; no pisa el de otra pantalla. */
  releasePatient: (owner: string) => void;
  reset: () => void;
};

export const useConversationStore = create<ConversationState>()((set) => ({
  patientId: null,
  patientName: null,
  owner: null,
  setPatient: (patientId, patientName = null, owner = null) =>
    set({
      patientId,
      patientName: patientId === null ? null : patientName,
      owner: patientId === null ? null : owner,
    }),
  releasePatient: (owner) =>
    set((state) =>
      state.owner === owner ? { patientId: null, patientName: null, owner: null } : state,
    ),
  reset: () => set({ patientId: null, patientName: null, owner: null }),
}));

// El contexto de paciente no sobrevive al
// cierre ni a la expiración de la sesión de acceso (FR-026 · US5-AC4 · Constitución V): al
// dejar de haber sesión activa se limpia, sea cual sea la pantalla en uso.
useSessionStore.subscribe((estado, anterior) => {
  if (anterior.accessState === "active" && estado.accessState !== "active") {
    useConversationStore.getState().reset();
  }
});
