import { beforeEach, describe, expect, test } from "bun:test";
import { useConversationStore } from "@/features/conocimiento/conversation-store";
import { useSessionStore } from "@/stores/session-store";

/**
 * Paciente de contexto del chat durante la sesión de acceso (FR-026 · US5-AC4 · chat-del-asistente
 * D8). Los turnos viven en `assistant_messages`, no aquí.
 */

beforeEach(() => {
  useConversationStore.getState().reset();
});

describe("conversation-store (FR-026 · US5-AC4)", () => {
  test("conserva el contexto del paciente y su nombre entre navegaciones de la sesión", () => {
    useConversationStore.getState().setPatient("patient-1", "Bruma");

    // La navegación no reinicia el store: el estado vive a nivel de sesión.
    expect(useConversationStore.getState()).toMatchObject({
      patientId: "patient-1",
      patientName: "Bruma",
    });
  });

  test("cambiar de paciente reemplaza el contexto y su nombre", () => {
    const store = useConversationStore.getState();
    store.setPatient("patient-1", "Bruma");
    store.setPatient("patient-2", "Rocky");
    expect(useConversationStore.getState()).toMatchObject({
      patientId: "patient-2",
      patientName: "Rocky",
    });
  });

  test("sin paciente el modo queda explícito (FR-051 · US5-AC10) y no queda un nombre huérfano", () => {
    const store = useConversationStore.getState();
    store.setPatient("patient-1", "Bruma");
    store.setPatient(null, "Bruma");
    expect(useConversationStore.getState()).toMatchObject({ patientId: null, patientName: null });
  });

  test("reset cierra el contexto con la sesión", () => {
    const store = useConversationStore.getState();
    store.setPatient("patient-1", "Bruma");
    store.reset();
    expect(useConversationStore.getState()).toMatchObject({ patientId: null, patientName: null });
  });
});

describe("ciclo de sesión (FR-026 · US5-AC4 · Constitución V)", () => {
  const identidad = {
    veterinarianId: "vet-1",
    displayName: "Dra. Ana",
    clinicId: "clinic-1",
    accessSessionId: "session-1",
  };

  test("expirar la sesión de acceso limpia el contexto", () => {
    useSessionStore.getState().setIdentity(identidad);
    useConversationStore.getState().setPatient("patient-1", "Bruma");

    useSessionStore.getState().setAccessState("expired");

    expect(useConversationStore.getState()).toMatchObject({ patientId: null, patientName: null });
  });

  test("cerrar la sesión limpia el contexto", () => {
    useSessionStore.getState().setIdentity(identidad);
    useConversationStore.getState().setPatient("patient-1", "Bruma");

    useSessionStore.getState().clear();

    expect(useConversationStore.getState().patientId).toBeNull();
  });
});
