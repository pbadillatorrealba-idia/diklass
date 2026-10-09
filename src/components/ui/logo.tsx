import { Image } from "react-native";
import { useColorScheme } from "@/theme/use-color-scheme";

// Tinta sobre la hoja clara, blanco sobre la oscura; ambos recortes de `assets/brand`
// (identidad-visual D4/D5). Si el trazado SVG resulta fiel, solo cambian estas dos fuentes.
const SOURCES = {
  light: require("../../../assets/brand/wordmark-tinta.png"),
  dark: require("../../../assets/brand/wordmark-blanco.png"),
};
const HEIGHTS = { sm: 20, md: 28, lg: 44 } as const;
const ASPECT_RATIO = 1087 / 200;

/** Wordmark de Diklass. Es la marca, no un encabezado: el `h1` de cada pantalla sigue siendo suyo. */
export function Logo({ size = "md" }: { size?: keyof typeof HEIGHTS }) {
  return (
    <Image
      accessibilityLabel="Diklass"
      accessibilityRole="image"
      accessible
      resizeMode="contain"
      role="img"
      source={SOURCES[useColorScheme()]}
      style={{ height: HEIGHTS[size], width: Math.round(HEIGHTS[size] * ASPECT_RATIO) }}
    />
  );
}
