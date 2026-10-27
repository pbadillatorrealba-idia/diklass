import { beforeEach, describe, expect, test } from "bun:test";
import { useConversationStore } from "@/features/conocimiento/conversation-store";

beforeEach(() => useConversationStore.getState().reset());
const store = () => useConversationStore.getState();

// asistente-conversacional «Paciente de contexto automático» y «Dueño y validez del contexto de
// paciente» (FR-026): lo fija la pantalla enfocada y se suelta al salir; el último en enfocarse gana y
// al salir solo suelta lo suyo.
describe("contexto de paciente con dueño", () => {
  test("al salir de la pantalla suelta el paciente y el nombre que ella fijó", () => {
    store().setPatient("bruma", "Bruma", "ficha");
    store().releasePatient("ficha");
    expect(store()).toMatchObject({ patientId: null, patientName: null, owner: null });
  });

  test("fija también el nombre para la etiqueta «Contexto: nombre»", () => {
    store().setPatient("bruma", "Bruma", "ficha");
    expect(store().patientName).toBe("Bruma");
  });

  test("sin nombre la etiqueta no inventa uno", () => {
    store().setPatient("bruma", undefined, "ficha");
    expect(store().patientName).toBeNull();
  });

  test("el último en enfocarse gana: al salir la anterior no pisa al nuevo", () => {
    store().setPatient("bruma", "Bruma", "ficha");
    store().setPatient("rocky", "Rocky", "consulta");
    store().releasePatient("ficha");
    expect(store()).toMatchObject({ patientId: "rocky", patientName: "Rocky", owner: "consulta" });
  });

  test("ficha y consulta del mismo paciente: la salida tardía de la ficha no lo borra", () => {
    store().setPatient("bruma", "Bruma", "ficha");
    store().setPatient("bruma", "Bruma", "consulta");
    store().releasePatient("ficha");
    expect(store().patientId).toBe("bruma");
    store().releasePatient("consulta");
    expect(store().patientId).toBeNull();
  });

  test("soltar sin haber fijado nada no hace nada", () => {
    store().releasePatient("nadie");
    expect(store().patientId).toBeNull();
  });
});
