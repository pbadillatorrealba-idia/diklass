import { createStore } from "zustand/vanilla";

/**
 * Preferencia de tema por dispositivo (FR-091 · design.md D17). `system` sigue al sistema
 * operativo; `light`/`dark` lo fijan. La preferencia no viaja al servidor.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

export const THEME_STORAGE_KEY = "diklass.theme";
const PREFERENCES: readonly ThemePreference[] = ["system", "light", "dark"];

export type ThemeStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference !== "system") return preference;
  return system === "dark" ? "dark" : "light";
}

function isPreference(value: unknown): value is ThemePreference {
  return PREFERENCES.includes(value as ThemePreference);
}

export type ThemeState = {
  preference: ThemePreference;
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

/**
 * `apply` fija el modo en la plataforma (clase en `<html>` o `Appearance`). Un almacenamiento
 * ilegible o bloqueado deja `system` sin error visible (caso límite de US16).
 */
export function createThemeStore(storage: ThemeStorage, apply: (p: ThemePreference) => void) {
  return createStore<ThemeState>((set) => ({
    preference: "system",
    hydrate: async () => {
      let stored: string | null = null;
      try {
        stored = await storage.getItem(THEME_STORAGE_KEY);
      } catch {
        stored = null;
      }
      const preference = isPreference(stored) ? stored : "system";
      set({ preference });
      apply(preference);
    },
    setPreference: async (preference) => {
      set({ preference });
      apply(preference);
      try {
        await storage.setItem(THEME_STORAGE_KEY, preference);
      } catch {
        // Sin persistencia la preferencia dura la sesión: no es un error para el usuario.
      }
    },
  }));
}
