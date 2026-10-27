import { describe, expect, test } from "bun:test";
import { elapsedSince, formatElapsed, startedAtFor } from "@/features/voz/use-elapsed";

// sistema-visual «Escucha siempre visible»: tiempo mm:ss desde que la captura pasa a `capturando`.
describe("formato del tiempo transcurrido", () => {
  test.each([
    [0, "00:00"],
    [999, "00:00"],
    [1_000, "00:01"],
    [65_000, "01:05"],
    [10 * 60_000 + 9_000, "10:09"],
    // Pasada la hora se sigue contando en minutos: una consulta larga no reinicia el reloj.
    [3_600_000 + 5_000, "60:05"],
  ])("%d ms → %s", (ms, esperado) => {
    expect(formatElapsed(ms)).toBe(esperado);
  });

  test("un reloj que retrocede no produce tiempo negativo", () => {
    expect(formatElapsed(-5_000)).toBe("00:00");
  });
});

describe("inicio de la captura", () => {
  test("empieza al pasar a `capturando` y se conserva mientras dura", () => {
    expect(startedAtFor(null, "capturando", 1_000)).toBe(1_000);
    expect(startedAtFor(1_000, "capturando", 9_000)).toBe(1_000);
  });

  test.each(["inactivo", "detenido", "no_disponible"] as const)(
    "se detiene y reinicia en `%s`",
    (estado) => {
      expect(startedAtFor(1_000, estado, 9_000)).toBeNull();
    },
  );

  test("una captura nueva tras detener parte de cero", () => {
    const detenida = startedAtFor(1_000, "detenido", 5_000);
    expect(startedAtFor(detenida, "capturando", 20_000)).toBe(20_000);
  });
});

describe("tiempo transcurrido con reloj inyectado", () => {
  test("sin captura es 00:00", () => {
    expect(elapsedSince(null, 50_000)).toBe("00:00");
  });

  test("con captura es la diferencia con el reloj", () => {
    expect(elapsedSince(1_000, 66_000)).toBe("01:05");
  });
});
