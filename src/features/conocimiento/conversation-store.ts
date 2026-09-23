import { create } from "zustand";
import { useSessionStore } from "@/stores/session-store";
import type { KnowledgeAnswer } from "./schema";

/**
 * Conversación con el asistente durante la sesión de acceso (D8 del diseño del cambio):
 * conserva el contexto del paciente seleccionado y los turnos de la sesión (FR-026 ·
 * US5-AC4). La persistencia es otra: cada consulta se registra aparte en
 * `knowledge_queries` para la reconstrucción (FR-020 · D6).
 */

export type TurnoConversacion = {
  id: string;
  pregunta: string;
  queryId: string | null;
  respuesta: KnowledgeAnswer;
};

export type ConversationState = {
  patientId: string | null;
  turnos: TurnoConversacion[];
  setPatient: (patientId: string | null) => void;
  addTurno: (turno: TurnoConversacion) => void;
  reset: () => void;
};

export const useConversationStore = create<ConversationState>()((set) => ({
  patientId: null,
  turnos: [],
  setPatient: (patientId) => set({ patientId }),
  addTurno: (turno) => set((state) => ({ turnos: [...state.turnos, turno] })),
  reset: () => set({ patientId: null, turnos: [] }),
}));

// El contexto conversacional —incluido el snapshot de ficha de cada turno— no sobrevive al
// cierre ni a la expiración de la sesión de acceso (FR-026 · US5-AC4 · Constitución V): al
// dejar de haber sesión activa se limpia, sea cual sea la pantalla en uso.
useSessionStore.subscribe((estado, anterior) => {
  if (anterior.accessState === "active" && estado.accessState !== "active") {
    useConversationStore.getState().reset();
  }
});
