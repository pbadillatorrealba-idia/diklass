import { useColorScheme as useSystemColorScheme } from "react-native";
import { useStore } from "zustand";
import { type ColorScheme, resolveScheme } from "./theme-preference";
import { themeStore } from "./theme-store";

/** Preferencia de tema y su cambio (FR-091). */
export function useThemePreference() {
  const preference = useStore(themeStore, (state) => state.preference);
  const setPreference = useStore(themeStore, (state) => state.setPreference);
  return { preference, setPreference };
}

/** Esquema efectivo: la preferencia fijada o, con `system`, el del sistema operativo. */
export function useColorScheme(): ColorScheme {
  const preference = useStore(themeStore, (state) => state.preference);
  return resolveScheme(preference, useSystemColorScheme());
}
