import { describe, expect, test } from "bun:test";
import { formatRut, normalizeRut, rutCheckDigit } from "@/lib/rut";

describe("rut", () => {
  test("calcula el dígito verificador (módulo 11)", () => {
    expect(rutCheckDigit("11111111")).toBe("1");
    expect(rutCheckDigit("12345678")).toBe("5");
    expect(rutCheckDigit("7654321")).toBe("6");
    // resto 10 → K, resto 11 → 0
    expect(rutCheckDigit("10000013")).toBe("K");
    expect(rutCheckDigit("10000004")).toBe("0");
  });

  test("normaliza puntos, espacios y minúsculas a la forma canónica", () => {
    expect(normalizeRut("12.345.678-5")).toBe("12345678-5");
    expect(normalizeRut(" 123456785 ")).toBe("12345678-5");
    expect(normalizeRut("10.000.013-k")).toBe("10000013-K");
  });

  test("rechaza dígito verificador o formato erróneo", () => {
    expect(normalizeRut("12.345.678-4")).toBeNull();
    expect(normalizeRut("1234-5")).toBeNull();
    expect(normalizeRut("abc")).toBeNull();
    expect(normalizeRut("")).toBeNull();
  });

  test("formatea para mostrar", () => {
    expect(formatRut("12345678-5")).toBe("12.345.678-5");
    expect(formatRut("7654321-6")).toBe("7.654.321-6");
    expect(formatRut("sin rut")).toBe("sin rut");
  });
});
