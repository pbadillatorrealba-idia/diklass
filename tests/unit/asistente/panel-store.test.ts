import { describe, expect, test } from "bun:test";
import {
  clampPanelWidth,
  contentWidthFor,
  createPanelStore,
  PANEL_MAX_WIDTH,
  PANEL_MIN_WIDTH,
  PANEL_STORAGE_KEY,
  PANEL_WIDTH,
  type PanelStorage,
  presentationFor,
  SIDEBAR_WIDTH,
} from "@/features/asistente/panel-store";

const memoryStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  const storage: PanelStorage = {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
  return { data, storage };
};

const throwing: PanelStorage = {
  getItem: () => {
    throw new Error("bloqueado");
  },
  setItem: () => {
    throw new Error("bloqueado");
  },
};

// sistema-visual «Panel de asistente colapsable»: estado recordado por dispositivo y degradado.
describe("estado del panel", () => {
  test("empieza expandido y en «Conocimiento»", () => {
    const store = createPanelStore(memoryStorage().storage);
    expect(store.getState().expanded).toBe(true);
    expect(store.getState().activeThread).toBe("conocimiento");
  });

  test("lo guardado en el dispositivo se lee al crear el almacén", () => {
    const { storage } = memoryStorage({
      [PANEL_STORAGE_KEY]: JSON.stringify({ expanded: false, activeThread: "escucha" }),
    });
    const store = createPanelStore(storage);
    expect(store.getState().expanded).toBe(false);
    expect(store.getState().activeThread).toBe("escucha");
  });

  test("colapsar y cambiar de hilo se persisten", () => {
    const { data, storage } = memoryStorage();
    const store = createPanelStore(storage);
    store.getState().setExpanded(false);
    store.getState().setActiveThread("asistente");
    expect(JSON.parse(data[PANEL_STORAGE_KEY] ?? "")).toEqual({
      expanded: false,
      activeThread: "asistente",
      width: PANEL_WIDTH,
    });
    expect(createPanelStore(storage).getState().expanded).toBe(false);
  });

  test.each([
    ["JSON ilegible", "{no"],
    ["tipos inválidos", JSON.stringify({ expanded: "si", activeThread: 3 })],
    ["no es un objeto", "7"],
  ])("un valor guardado inválido (%s) degrada a los valores por defecto", (_caso, raw) => {
    const store = createPanelStore(memoryStorage({ [PANEL_STORAGE_KEY]: raw }).storage);
    expect(store.getState().expanded).toBe(true);
    expect(store.getState().activeThread).toBe("conocimiento");
  });

  test("un almacenamiento que lanza degrada y no impide cambiar el estado", () => {
    const store = createPanelStore(throwing);
    expect(store.getState().expanded).toBe(true);
    expect(() => store.getState().setExpanded(false)).not.toThrow();
    expect(store.getState().expanded).toBe(false);
  });

  test("sin almacenamiento (nativo) el estado dura la sesión", () => {
    const store = createPanelStore(null);
    store.getState().setActiveThread("escucha");
    expect(store.getState().activeThread).toBe("escucha");
  });
});

// design.md D2: presentación por ancho de ventana.
describe("presentación por ancho", () => {
  test.each([
    [1920, "docked"],
    [1440, "docked"],
    [1439, "rail"],
    [1024, "rail"],
    [1023, "dock"],
    [375, "dock"],
  ] as const)("%d px → %s", (ancho, esperado) => {
    expect(presentationFor(ancho)).toBe(esperado);
  });
});

// El panel se redimensiona con el mouse: el ancho se acota, se recuerda y el contenido lo descuenta.
describe("ancho del panel", () => {
  test("empieza en 360 px y se acota entre el mínimo y el máximo", () => {
    expect(createPanelStore(null).getState().width).toBe(PANEL_WIDTH);
    expect(clampPanelWidth(10)).toBe(PANEL_MIN_WIDTH);
    expect(clampPanelWidth(9999)).toBe(PANEL_MAX_WIDTH);
    expect(clampPanelWidth(400.4)).toBe(400);
    expect(clampPanelWidth(Number.NaN)).toBe(PANEL_WIDTH);
  });

  test("se persiste acotado y se lee al crear el almacén", () => {
    const { data, storage } = memoryStorage();
    const store = createPanelStore(storage);
    store.getState().setWidth(9999);
    expect(store.getState().width).toBe(PANEL_MAX_WIDTH);
    expect(JSON.parse(data[PANEL_STORAGE_KEY] ?? "").width).toBe(PANEL_MAX_WIDTH);
    expect(createPanelStore(storage).getState().width).toBe(PANEL_MAX_WIDTH);
  });

  test("un ancho guardado inválido degrada al de por defecto", () => {
    const raw = JSON.stringify({ expanded: true, activeThread: "x", width: "ancho" });
    expect(
      createPanelStore(memoryStorage({ [PANEL_STORAGE_KEY]: raw }).storage).getState().width,
    ).toBe(PANEL_WIDTH);
  });

  test("el contenido descuenta el ancho elegido, no el de por defecto", () => {
    expect(contentWidthFor(1600, true, 500)).toBe(1600 - SIDEBAR_WIDTH - 500);
    expect(contentWidthFor(1600, true)).toBe(1600 - SIDEBAR_WIDTH - PANEL_WIDTH);
  });
});
