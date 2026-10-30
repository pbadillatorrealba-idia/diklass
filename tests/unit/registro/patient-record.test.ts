import { describe, expect, test } from "bun:test";
import { ageLabel } from "@/components/registro/patient-record";

const now = new Date(2026, 9, 9); // 9 oct 2026

describe("ageLabel", () => {
  test("se calcula desde la fecha de nacimiento", () => {
    expect(ageLabel("2022-08-09", null, now)).toBe("4 años 2 meses");
    expect(ageLabel("2022-10-10", null, now)).toBe("3 años 11 meses");
    expect(ageLabel("2026-03-01", null, now)).toBe("7 meses");
    expect(ageLabel("2025-10-09", null, now)).toBe("1 año");
  });

  test("sin fecha usa los meses registrados y sin ninguno no inventa", () => {
    expect(ageLabel(null, 14, now)).toBe("1 año 2 meses");
    expect(ageLabel(null, null, now)).toBeNull();
    expect(ageLabel("2026-10-01", null, now)).toBe("Menos de 1 mes");
  });
});
