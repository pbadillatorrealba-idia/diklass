import { useSyncExternalStore } from "react";
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

const noopSubscribe = () => () => {};

/**
 * `false` en el render del servidor y en el primero de la hidratación; `true` después. Sin esto el
 * primer render del cliente ya usa el esquema oscuro mientras el HTML estático se pintó en claro:
 * React no corrige atributos al hidratar y los colores en línea (`Input`) se quedaban claros sobre
 * fondo oscuro (contraste 1.01:1).
 */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** Esquema efectivo: la preferencia fijada o, con `system`, el del sistema operativo. */
export function useColorScheme(): ColorScheme {
  const preference = useStore(themeStore, (state) => state.preference);
  const system = useSystemColorScheme();
  // El HTML estático se genera en claro: el primer render debe coincidir con él.
  return useHydrated() ? resolveScheme(preference, system) : "light";
}
