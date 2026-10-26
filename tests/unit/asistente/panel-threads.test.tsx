import { describe, expect, test } from "bun:test";
import {
  createThreadRegistry,
  FALLBACK_THREAD,
  resolveActiveThread,
} from "@/features/asistente/panel-threads";

const hilo = (id: string) => ({ id, label: id, element: null });
const ids = (registry: ReturnType<typeof createThreadRegistry>) =>
  registry
    .getState()
    .list()
    .map((h) => h.id);

// sistema-visual «Hilos contextuales del panel».
describe("registro de hilos", () => {
  test("una pantalla declara hilos y desaparecen al desmontar", () => {
    const registry = createThreadRegistry();
    registry.getState().register("consulta", [hilo("escucha")]);
    registry.getState().register("shell", [hilo("conocimiento"), hilo("asistente")]);
    expect(ids(registry)).toEqual(["escucha", "conocimiento", "asistente"]);
    registry.getState().unregister("consulta");
    expect(ids(registry)).toEqual(["conocimiento", "asistente"]);
  });

  test("volver a registrar al mismo dueño reemplaza sus hilos", () => {
    const registry = createThreadRegistry();
    registry.getState().register("consulta", [hilo("escucha")]);
    registry.getState().register("consulta", [hilo("otro")]);
    expect(ids(registry)).toEqual(["otro"]);
  });

  test("el orden es el de aparición, no el del último registro", () => {
    const registry = createThreadRegistry();
    registry.getState().register("a", [hilo("uno")]);
    registry.getState().register("b", [hilo("dos")]);
    registry.getState().register("a", [hilo("uno")]);
    expect(ids(registry)).toEqual(["uno", "dos"]);
  });
});

describe("hilo activo", () => {
  test("se conserva si sigue disponible", () => {
    expect(resolveActiveThread("escucha", ["escucha", "conocimiento"])).toBe("escucha");
  });

  test("pasa a «Conocimiento» si ya no está disponible", () => {
    expect(resolveActiveThread("escucha", ["conocimiento", "asistente"])).toBe(FALLBACK_THREAD);
    expect(FALLBACK_THREAD).toBe("conocimiento");
  });

  test("si tampoco está «Conocimiento», pasa al primero disponible", () => {
    expect(resolveActiveThread("escucha", ["asistente"])).toBe("asistente");
    expect(resolveActiveThread("escucha", [])).toBe(FALLBACK_THREAD);
  });
});
