import { create } from "zustand";
import type { KnowledgeAnswer } from "@/features/conocimiento/schema";
import { useSessionStore } from "@/stores/session-store";

/**
 * Conversación del hilo «Asistente» durante la sesión de acceso: respuestas de las consultas
 * básicas (texto) y de la base de conocimiento (con cita). Como `conversation-store`, no sobrevive
 * al cierre ni a la expiración de la sesión (Constitución V).
 */
export type RespuestaAsistente =
  | { tipo: "texto"; texto: string }
  | { tipo: "conocimiento"; answer: KnowledgeAnswer };

export type TurnoAsistente = { id: string; pregunta: string; respuesta: RespuestaAsistente };

export type AsistenteState = {
  turnos: TurnoAsistente[];
  addTurno: (turno: TurnoAsistente) => void;
  reset: () => void;
};

export const useAsistenteStore = create<AsistenteState>()((set) => ({
  turnos: [],
  addTurno: (turno) => set((state) => ({ turnos: [...state.turnos, turno] })),
  reset: () => set({ turnos: [] }),
}));

useSessionStore.subscribe((estado, anterior) => {
  if (anterior.accessState === "active" && estado.accessState !== "active") {
    useAsistenteStore.getState().reset();
  }
});
