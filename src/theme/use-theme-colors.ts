import { palette } from "@/theme/colors";
import { useColorScheme } from "@/theme/use-color-scheme";

/** Tokens del esquema activo, para las props de color que no admiten `className`. */
export function useThemeColors() {
  return palette[useColorScheme()];
}
