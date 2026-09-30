import { describe, expect, test } from "bun:test";
import { SIGNATURE_MS } from "@/components/registro/signature-motion";

// FR-099 · design.md D20: la firma es un solo movimiento de como máximo 300 ms.
describe("firma", () => {
  test("SIGNATURE_MS dura como máximo 300 ms", () => {
    expect(SIGNATURE_MS).toBeGreaterThan(0);
    expect(SIGNATURE_MS).toBeLessThanOrEqual(300);
  });
});
