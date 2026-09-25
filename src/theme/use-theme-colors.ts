import { useColorScheme } from "react-native";
import { palette } from "@/theme/colors";

/** Tokens del esquema activo, para las props de color que no admiten `className`. */
export function useThemeColors() {
  return palette[useColorScheme() === "dark" ? "dark" : "light"];
}
