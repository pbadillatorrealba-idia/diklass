import { describe, expect, test } from "bun:test";
import {
  canTransition,
  isPersistable,
  type Message,
  mergeMessages,
  messageText,
  newMessageId,
} from "@/features/asistente/chat-model";

const mensaje = (over: Partial<Message> = {}): Message => ({
  id: "m1",
  role: "user",
  createdAt: "2026-10-27T12:00:00.000Z",
  status: "done",
  patientId: null,
  parts: [{ type: "text", text: "hola" }],
  ...over,
});

// asistente-conversacional «Persistencia de mensajes terminales» (design.md D1 · D3).
describe("estados del mensaje", () => {
  test.each([
    ["sending", false],
    ["thinking", false],
    ["done", true],
    ["error", true],
  ] as const)("«%s» persistible: %s", (status, persistible) => {
    expect(isPersistable(mensaje({ status }))).toBe(persistible);
  });

  test.each([
    ["sending", "thinking", true],
    ["sending", "done", true],
    ["sending", "error", true],
    ["thinking", "done", true],
    ["thinking", "error", true],
    ["error", "sending", true],
    ["done", "error", false],
    ["done", "sending", false],
    ["done", "thinking", false],
    ["thinking", "sending", false],
    ["error", "done", false],
  ] as const)("%s → %s: %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });
});

// «Acciones del mensaje»: copiar el texto de un mensaje.
describe("texto de un mensaje", () => {
  test("une las partes con texto y deja fuera las que no lo tienen", () => {
    const texto = messageText(
      mensaje({
        parts: [
          { type: "text", text: "uno" },
          { type: "notice", text: "aviso" },
          {
            type: "audio",
            durationMs: 5000,
            transcript: "dos",
            audioPath: null,
            audioState: "expired",
          },
        ],
      }),
    );
    expect(texto).toBe("uno\n\naviso\n\ndos");
  });

  test("una respuesta de conocimiento aporta su texto de respuesta", () => {
    const texto = messageText(
      mensaje({
        role: "assistant",
        parts: [
          {
            type: "knowledge",
            queryId: "q1",
            answer: {
              segmentos: [{ texto: "respuesta uno" }, { texto: "respuesta dos" }],
            } as never,
          },
        ],
      }),
    );
    expect(texto).toBe("respuesta uno\nrespuesta dos");
  });

  test("sin partes con texto es vacío", () => {
    expect(messageText(mensaje({ parts: [] }))).toBe("");
  });
});

// Los ids de mensaje son la clave primaria uuid de `assistant_messages`.
describe("newMessageId", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  test("genera un uuid v4", () => {
    expect(newMessageId()).toMatch(UUID);
  });

  test("sin crypto.randomUUID (Hermes) genera uno válido y distinto cada vez", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      const a = newMessageId();
      const b = newMessageId();
      expect(a).toMatch(UUID);
      expect(a).not.toBe(b);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: original, configurable: true });
    }
  });
});

// Entre persistir la pregunta y terminar el turno, el mismo mensaje está en la caché y en los pendientes.
describe("mergeMessages", () => {
  test("los pendientes van al final y no repiten un mensaje ya persistido", () => {
    const persistidos = [mensaje({ id: "a" }), mensaje({ id: "u" })];
    const pendientes = [
      mensaje({ id: "u", status: "sending" }),
      mensaje({ id: "p", status: "thinking" }),
    ];
    expect(mergeMessages(persistidos, pendientes).map((m) => [m.id, m.status])).toEqual([
      ["a", "done"],
      ["u", "done"],
      ["p", "thinking"],
    ]);
  });

  test("sin pendientes devuelve los persistidos", () => {
    const persistidos = [mensaje({ id: "a" })];
    expect(mergeMessages(persistidos, [])).toEqual(persistidos);
  });
});
