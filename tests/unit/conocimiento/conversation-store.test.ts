import { beforeEach, describe, expect, test } from "bun:test";
import {
  type TurnoConversacion,
  useConversationStore,
} from "@/features/conocimiento/conversation-store";
import type { KnowledgeAnswer } from "@/features/conocimiento/schema";

/**
 * Contexto de la conversación del asistente durante la sesión de acceso (D8 de
 * design.md). Tarea 2.3.
 */

function respuesta(patientId: string | null): KnowledgeAnswer {
  return {
    pregunta: "¿Qué antecedentes revisar?",
    patientId,
    segmentos: [],
    cobertura: { estado: "sin_evidencia", cubiertos: [], noCubiertos: [] },
    avisos: [],
  };
}

function turno(patientId: string | null, id: string): TurnoConversacion {
  return {
    id,
    pregunta: "¿Qué antecedentes revisar?",
    queryId: `query-${id}`,
    respuesta: respuesta(patientId),
  };
}

beforeEach(() => {
  useConversationStore.getState().reset();
});

describe("conversation-store (FR-026 · US5-AC4)", () => {
  test("conserva el contexto del paciente y los turnos entre navegaciones de la sesión", () => {
    const store = useConversationStore.getState();
    store.setPatient("patient-1");
    store.addTurno(turno("patient-1", "t1"));

    // La navegación no reinicia el store: el estado vive a nivel de sesión.
    const trasNavegar = useConversationStore.getState();
    expect(trasNavegar.patientId).toBe("patient-1");
    expect(trasNavegar.turnos.map((t) => t.id)).toEqual(["t1"]);
  });

  test("varias preguntas seguidas acumulan turnos en orden", () => {
    const store = useConversationStore.getState();
    store.setPatient("patient-1");
    store.addTurno(turno("patient-1", "t1"));
    store.addTurno(turno("patient-1", "t2"));
    expect(useConversationStore.getState().turnos.map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  test("cambiar de paciente marca el contexto sin atribuir los turnos anteriores al nuevo", () => {
    const store = useConversationStore.getState();
    store.setPatient("patient-1");
    store.addTurno(turno("patient-1", "t1"));
    store.setPatient("patient-2");

    const estado = useConversationStore.getState();
    expect(estado.patientId).toBe("patient-2");
    expect(estado.turnos[0]?.respuesta.patientId).toBe("patient-1");
  });

  test("sin paciente seleccionado el modo queda explícito (FR-051 · US5-AC10)", () => {
    const store = useConversationStore.getState();
    store.setPatient(null);
    store.addTurno(turno(null, "t1"));

    const estado = useConversationStore.getState();
    expect(estado.patientId).toBeNull();
    expect(estado.turnos[0]?.respuesta.patientId).toBeNull();
  });

  test("reset cierra el contexto con la sesión", () => {
    const store = useConversationStore.getState();
    store.setPatient("patient-1");
    store.addTurno(turno("patient-1", "t1"));
    store.reset();
    expect(useConversationStore.getState()).toMatchObject({ patientId: null, turnos: [] });
  });
});
