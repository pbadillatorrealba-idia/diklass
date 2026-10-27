import { beforeEach, describe, expect, test } from "bun:test";
import type { Message } from "@/features/asistente/chat-model";
import { useChatStore } from "@/features/asistente/chat-store";
import { useSessionStore } from "@/stores/session-store";

const pendiente = (over: Partial<Message> = {}): Message => ({
  id: "m1",
  role: "user",
  createdAt: "2026-10-27T12:00:00.000Z",
  status: "sending",
  patientId: null,
  parts: [{ type: "text", text: "hola" }],
  ...over,
});
const store = () => useChatStore.getState();

beforeEach(() => store().reset());

// asistente-conversacional «Composer del chat» (borrador), «Mensajes del chat» (pendientes) y «Aviso de respuesta nueva».
describe("borrador por hilo", () => {
  test("sobrevive al cambio de hilo y es independiente por hilo", () => {
    store().setDraft("asistente", "¿dosis de meloxicam?");
    store().setDraft("escucha", "otra cosa");
    expect(store().drafts.asistente).toBe("¿dosis de meloxicam?");
    expect(store().drafts.escucha).toBe("otra cosa");
  });

  test("vaciarlo lo elimina", () => {
    store().setDraft("asistente", "texto");
    store().setDraft("asistente", "");
    expect(store().drafts.asistente).toBeUndefined();
  });
});

describe("mensajes pendientes", () => {
  test("avanzan por las transiciones permitidas", () => {
    store().addPending(pendiente());
    store().setPendingStatus("m1", "thinking");
    expect(store().pending[0]?.status).toBe("thinking");
  });

  test("una transición no permitida se ignora", () => {
    store().addPending(pendiente({ status: "thinking" }));
    store().setPendingStatus("m1", "sending");
    expect(store().pending[0]?.status).toBe("thinking");
  });

  test("reintentar un error lo reenvía sin duplicarlo", () => {
    store().addPending(pendiente({ status: "error" }));
    store().setPendingStatus("m1", "sending");
    expect(store().pending).toHaveLength(1);
    expect(store().pending[0]?.status).toBe("sending");
  });

  test("se quita al persistirse", () => {
    store().addPending(pendiente());
    store().removePending("m1");
    expect(store().pending).toEqual([]);
  });
});

describe("no leído", () => {
  test("sube con cada respuesta fuera de vista y se pone a cero al abrir el hilo", () => {
    store().addUnread();
    store().addUnread();
    expect(store().unread).toBe(2);
    store().clearUnread();
    expect(store().unread).toBe(0);
  });
});

describe("sesión de acceso", () => {
  test("se limpia al salir de la sesión activa (Constitución V)", () => {
    useSessionStore.setState({ accessState: "active" });
    store().setDraft("asistente", "borrador");
    store().addPending(pendiente());
    store().addUnread();
    useSessionStore.setState({ accessState: "expired" });
    expect(store().drafts).toEqual({});
    expect(store().pending).toEqual([]);
    expect(store().unread).toBe(0);
  });
});
