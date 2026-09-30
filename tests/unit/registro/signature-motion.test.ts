import { describe, expect, test } from "bun:test";
import { SIGNATURE_EASING, SIGNATURE_MS } from "@/components/registro/signature-motion";

// FR-099 · design.md D20: la firma es un solo movimiento de como máximo 300 ms.
describe("firma", () => {
  test("SIGNATURE_MS dura como máximo 300 ms", () => {
    expect(SIGNATURE_MS).toBeGreaterThan(0);
    expect(SIGNATURE_MS).toBeLessThanOrEqual(300);
  });

  // Revisión de la PR #41: la curva termina exactamente en el estado final.
  test("la salida de la firma empieza en 0 y termina exactamente en 1", () => {
    expect(SIGNATURE_EASING(0)).toBe(0);
    expect(SIGNATURE_EASING(1)).toBe(1);
  });
});
