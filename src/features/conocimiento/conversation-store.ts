import { create } from "zustand";
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
