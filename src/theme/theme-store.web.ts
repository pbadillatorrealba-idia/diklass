import { createThemeStore } from "./theme-preference";

const storage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Web: la clase `light`/`dark` en `<html>` activa los bloques `:root.light`/`:root.dark` de
 * `global.css`, que ganan a la media query. `+html.tsx` hace lo mismo antes del primer pintado
 * (design.md D17).
 */
export const themeStore = createThemeStore(
  {
    getItem: async (key) => storage()?.getItem(key) ?? null,
    setItem: async (key, value) => storage()?.setItem(key, value),
  },
  (preference) => {
    const root = globalThis.document?.documentElement;
    if (!root) return;
    root.classList.remove("light", "dark");
    if (preference !== "system") root.classList.add(preference);
  },
);
