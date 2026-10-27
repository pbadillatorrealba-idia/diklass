import { beforeEach, describe, expect, test } from "bun:test";
import { useConversationStore } from "@/features/conocimiento/conversation-store";
import { releasePatientContext } from "@/features/conocimiento/use-patient-context";

beforeEach(() => useConversationStore.getState().reset());

// FR-026: el contexto de paciente lo fija la pantalla y se suelta al salir, para que el hilo
// «Asistente» no responda con el paciente de una consulta anterior.
describe("releasePatientContext", () => {
  test("al salir de la pantalla suelta el paciente que ella fijó", () => {
    useConversationStore.getState().setPatient("bruma");
    releasePatientContext("bruma");
    expect(useConversationStore.getState().patientId).toBeNull();
  });

  test("no pisa un paciente que eligió otra pantalla o el selector", () => {
    useConversationStore.getState().setPatient("rocky");
    releasePatientContext("bruma");
    expect(useConversationStore.getState().patientId).toBe("rocky");
  });
});
