import * as SecureStore from "expo-secure-store";
import { Appearance } from "react-native";
import { createThemeStore } from "./theme-preference";

/**
 * Nativo: el modo se fija con `Appearance`, que NativeWind y `useColorScheme()` siguen, y la
 * preferencia se guarda en el llavero del dispositivo (design.md D17).
 */
export const themeStore = createThemeStore(
  {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
  },
  (preference) => Appearance.setColorScheme(preference === "system" ? "unspecified" : preference),
);
