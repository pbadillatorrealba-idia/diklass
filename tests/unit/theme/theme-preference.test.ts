import { describe, expect, test } from "bun:test";
import {
  createThemeStore,
  resolveScheme,
  THEME_STORAGE_KEY,
  type ThemeStorage,
} from "@/theme/theme-preference";

const memoryStorage = (
  initial: Record<string, string> = {},
): ThemeStorage & {
  data: Record<string, string>;
} => {
  const data = { ...initial };
  return {
    data,
    getItem: async (key) => data[key] ?? null,
    setItem: async (key, value) => {
      data[key] = value;
    },
  };
};

// sistema-visual FR-091 · design.md D17.
describe("preferencia de tema", () => {
  test.each([
    ["system", "dark", "dark"],
    ["system", "light", "light"],
    ["system", null, "light"],
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
  ] as const)("%s con el sistema en %s resuelve %s", (preference, system, expected) => {
    expect(resolveScheme(preference, system)).toBe(expected);
  });

  test("empieza en system y aplica lo guardado al hidratar", async () => {
    const applied: string[] = [];
    const store = createThemeStore(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }), (p) =>
      applied.push(p),
    );
    expect(store.getState().preference).toBe("system");
    await store.getState().hydrate();
    expect(store.getState().preference).toBe("dark");
    expect(applied).toEqual(["dark"]);
  });

  test("setPreference aplica y persiste en el dispositivo", async () => {
    const storage = memoryStorage();
    const applied: string[] = [];
    const store = createThemeStore(storage, (p) => applied.push(p));
    await store.getState().setPreference("light");
    expect(store.getState().preference).toBe("light");
    expect(storage.data[THEME_STORAGE_KEY]).toBe("light");
    expect(applied).toEqual(["light"]);
  });

  test("un valor guardado inválido o un almacenamiento que falla degradan a system", async () => {
    const invalid = createThemeStore(memoryStorage({ [THEME_STORAGE_KEY]: "sepia" }), () => {});
    await invalid.getState().hydrate();
    expect(invalid.getState().preference).toBe("system");

    const broken: ThemeStorage = {
      getItem: async () => {
        throw new Error("almacenamiento bloqueado");
      },
      setItem: async () => {
        throw new Error("almacenamiento bloqueado");
      },
    };
    const store = createThemeStore(broken, () => {});
    await store.getState().hydrate();
    expect(store.getState().preference).toBe("system");
    await store.getState().setPreference("dark");
    expect(store.getState().preference).toBe("dark");
  });
});
