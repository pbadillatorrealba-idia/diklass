import { describe, expect, test } from "bun:test";
import { initialActiveSection } from "@/components/registro/active-section";

// Aclaración de D20 (2026-09-30): al cargar, la banda marca el paso siguiente del protocolo.
describe("initialActiveSection", () => {
  test("consulta abierta sin borrador → 1 Anamnesis", () => {
    expect(initialActiveSection({ isClosed: false, hasDraft: false })).toBe(1);
  });
  test("con borrador de epicrisis → 3 Epicrisis y firma", () => {
    expect(initialActiveSection({ isClosed: false, hasDraft: true })).toBe(3);
  });
  test("consulta cerrada → ninguna", () => {
    expect(initialActiveSection({ isClosed: true, hasDraft: false })).toBeNull();
  });
});
