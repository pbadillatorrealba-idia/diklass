import { describe, expect, test } from "bun:test";
import {
  diffMessages,
  isNearBottom,
  NEAR_BOTTOM_PX,
  nextAnchor,
  planScroll,
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

describe("nextAnchor no cambia sin necesidad", () => {
  // Cada evento de scroll pasa por aquí: devolver el mismo objeto evita re-renderizar la lista.
  test("sin cambio de ancla devuelve el mismo estado", () => {
    const anclado = { pinned: true, unseen: 0 };
    const leyendo = { pinned: false, unseen: 2 };
    expect(nextAnchor(anclado, { nearBottom: true })).toBe(anclado);
    expect(nextAnchor(leyendo, { nearBottom: false })).toBe(leyendo);
    expect(nextAnchor(anclado, {})).toBe(anclado);
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

// Qué hacer con el desplazamiento cuando cambia el tamaño del contenido, con la posición REAL de la
// vista en ese instante (no la del último evento de scroll, que puede faltar).
describe("planScroll", () => {
  const base = {
    y: 0,
    height: 400,
    prevContent: 1000,
    nextContent: 1100,
    keepPosition: false,
    forceEnd: false,
  };

  test("anclado abajo, sigue lo nuevo", () => {
    expect(planScroll({ ...base, y: 600 })).toEqual({ to: "end" });
  });

  test("leyendo arriba, no mueve nada", () => {
    expect(planScroll({ ...base, y: 0 })).toBeNull();
  });

  test("quien envía vuelve al final aunque leyera arriba", () => {
    expect(planScroll({ ...base, y: 0, forceEnd: true })).toEqual({ to: "end" });
  });

  test("al cargar anteriores conserva lo que leía: baja lo que creció el contenido", () => {
    expect(
      planScroll({ ...base, y: 0, keepPosition: true, nextContent: 2140, prevContent: 1000 }),
    ).toEqual({
      to: 1140,
    });
  });

  test("cargar anteriores manda sobre estar abajo (no arrastra al final)", () => {
    expect(planScroll({ ...base, y: 600, keepPosition: true })).toEqual({ to: 700 });
  });

  test("la primera carga (contenido previo casi vacío) se ancla al final", () => {
    expect(planScroll({ ...base, prevContent: 32, nextContent: 1936 })).toEqual({ to: "end" });
  });
});
