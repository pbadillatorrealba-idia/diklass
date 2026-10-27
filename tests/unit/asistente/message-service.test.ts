import { describe, expect, test } from "bun:test";
import {
  cursorFilter,
  flattenPages,
  PAGE_SIZE,
  rowToMessage,
} from "@/features/asistente/message-service";

const fila = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  clinic_id: "c1",
  author_id: "a1",
  role: "user",
  status: "done",
  parts: [{ type: "text", text: "hola" }],
  patient_id: null,
  audio_path: null,
  audio_expires_at: null,
  created_at: "2026-10-27T12:00:00.123456+00:00",
  ...over,
});

// asistente-conversacional «Conversación continua y privada»: los últimos 50 y «Cargar anteriores».
describe("rowToMessage", () => {
  test("convierte una fila en el mensaje del modelo", () => {
    expect(rowToMessage(fila())).toEqual({
      id: "m1",
      role: "user",
      createdAt: "2026-10-27T12:00:00.123456+00:00",
      status: "done",
      patientId: null,
      parts: [{ type: "text", text: "hola" }],
    });
  });

  test("conserva el paciente y las partes de audio", () => {
    const mensaje = rowToMessage(
      fila({
        patient_id: "p1",
        parts: [
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
    expect(mensaje?.patientId).toBe("p1");
    expect(mensaje?.parts[0]).toMatchObject({ type: "audio", audioState: "expired" });
  });

  test.each([
    ["una parte desconocida", { parts: [{ type: "otra", x: 1 }] }],
    ["un estado no terminal", { status: "thinking" }],
    ["un rol inválido", { role: "system" }],
    ["partes que no son una lista", { parts: { type: "text", text: "x" } }],
  ])("una fila ilegible con %s se omite (null)", (_nombre, over) => {
    expect(rowToMessage(fila(over))).toBeNull();
  });
});

describe("paginación por cursor", () => {
  test("la página es de 50", () => {
    expect(PAGE_SIZE).toBe(50);
  });

  test("sin cursor no hay filtro", () => {
    expect(cursorFilter(undefined)).toBeNull();
  });

  test("con cursor pide lo anterior por (created_at, id)", () => {
    expect(cursorFilter({ createdAt: "2026-10-27T12:00:00.5+00:00", id: "abc" })).toBe(
      'created_at.lt."2026-10-27T12:00:00.5+00:00",and(created_at.eq."2026-10-27T12:00:00.5+00:00",id.lt.abc)',
    );
  });
});

describe("flattenPages", () => {
  const msg = (id: string) => ({
    id,
    role: "user" as const,
    createdAt: id,
    status: "done" as const,
    patientId: null,
    parts: [],
  });

  test("las páginas llegan de la más nueva a la más antigua y la lista queda cronológica", () => {
    const paginas = [
      { messages: [msg("4"), msg("5")], next: { createdAt: "4", id: "4" } },
      { messages: [msg("2"), msg("3")], next: null },
    ];
    expect(flattenPages(paginas).map((m) => m.id)).toEqual(["2", "3", "4", "5"]);
  });

  test("sin páginas es vacío", () => {
    expect(flattenPages([])).toEqual([]);
  });
});
