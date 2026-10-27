import { describe, expect, test } from "bun:test";
import { nextStatusText } from "@/features/asistente/live-status";

describe("nextStatusText", () => {
  test.each([
    [false, true, false, "Pensando…"],
    [true, true, false, "Pensando…"],
    [true, false, true, "Respuesta lista"],
    [true, false, false, ""],
    [false, false, false, null],
    [false, false, true, null],
  ] as const)("antes %s, ahora %s, con respuesta %s → %s", (antes, ahora, con, esperado) => {
    expect(nextStatusText(antes, ahora, con)).toBe(esperado);
  });
});
