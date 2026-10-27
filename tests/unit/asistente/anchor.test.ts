import { describe, expect, test } from "bun:test";
import {
  diffMessages,
  isNearBottom,
  NEAR_BOTTOM_PX,
  nextAnchor,
  unseenLabel,
} from "@/features/asistente/anchor";

// asistente-conversacional «Lista de mensajes anclada» (design.md D10): una sola decisión de anclaje
// para la lista web y la nativa.
describe("isNearBottom", () => {
  const m = (scrollTop: number) => ({ scrollTop, clientHeight: 400, scrollHeight: 1000 });
  test.each([
    [600, true],
    [600 - NEAR_BOTTOM_PX, true],
    [600 - NEAR_BOTTOM_PX - 1, false],
    [0, false],
  ])("scrollTop %i → %s", (scrollTop, cerca) => {
    expect(isNearBottom(m(scrollTop))).toBe(cerca);
  });

  test("un contenido más corto que la vista siempre está abajo", () => {
    expect(isNearBottom({ scrollTop: 0, clientHeight: 400, scrollHeight: 200 })).toBe(true);
  });
});

describe("diffMessages", () => {
  test("la primera carga no cuenta como mensajes nuevos", () => {
    expect(diffMessages([], ["a", "b"])).toEqual({ kind: "initial", appended: 0, prepended: 0 });
  });

  test("mensajes al final son nuevos", () => {
    expect(diffMessages(["a", "b"], ["a", "b", "c", "d"])).toEqual({
      kind: "change",
      appended: 2,
      prepended: 0,
    });
  });

  test("mensajes al principio son «Cargar anteriores»", () => {
    expect(diffMessages(["c", "d"], ["a", "b", "c", "d"])).toEqual({
      kind: "change",
      appended: 0,
      prepended: 2,
    });
  });

  test("anteriores y nuevos a la vez", () => {
    expect(diffMessages(["b", "c"], ["a", "b", "c", "d"])).toEqual({
      kind: "change",
      appended: 1,
      prepended: 1,
    });
  });

  test("sin cambios", () => {
    expect(diffMessages(["a"], ["a"])).toEqual({ kind: "change", appended: 0, prepended: 0 });
  });

  test("el marcador «Pensando…» reemplazado por la respuesta cuenta como un mensaje nuevo", () => {
    expect(diffMessages(["a", "u", "p"], ["a", "u", "r"])).toEqual({
      kind: "change",
      appended: 1,
      prepended: 0,
    });
  });

  test("la pregunta persistida y su respuesta reemplazan a los pendientes", () => {
    expect(diffMessages(["a", "u", "p"], ["a", "u", "r", "s"])).toEqual({
      kind: "change",
      appended: 2,
      prepended: 0,
    });
  });

  test("si la lista se reemplaza (p. ej. borrar la conversación) no hay nuevos", () => {
    expect(diffMessages(["a", "b"], [])).toEqual({ kind: "change", appended: 0, prepended: 0 });
    expect(diffMessages(["a", "b"], ["x", "y"])).toEqual({
      kind: "change",
      appended: 0,
      prepended: 0,
    });
  });
});

describe("nextAnchor", () => {
  test("anclado, los nuevos se siguen y no se cuentan", () => {
    expect(nextAnchor({ pinned: true, unseen: 0 }, { appended: 2 })).toEqual({
      pinned: true,
      unseen: 0,
    });
  });

  test("leyendo arriba, los nuevos se cuentan y no se arrastra", () => {
    expect(nextAnchor({ pinned: false, unseen: 1 }, { appended: 1 })).toEqual({
      pinned: false,
      unseen: 2,
    });
  });

  test("al volver abajo se pone a cero", () => {
    expect(nextAnchor({ pinned: false, unseen: 3 }, { nearBottom: true })).toEqual({
      pinned: true,
      unseen: 0,
    });
  });

  test("subir quita el ancla sin tocar lo no visto", () => {
    expect(nextAnchor({ pinned: true, unseen: 0 }, { nearBottom: false })).toEqual({
      pinned: false,
      unseen: 0,
    });
  });
});

describe("unseenLabel", () => {
  test.each([
    [1, "1 nuevo"],
    [2, "2 nuevos"],
    [12, "12 nuevos"],
  ])("%i → %s", (n, texto) => {
    expect(unseenLabel(n)).toBe(texto);
  });
});
