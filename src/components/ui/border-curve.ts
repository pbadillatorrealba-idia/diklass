import type { ViewStyle } from "react-native";

/**
 * Esquinas continuas de iOS (design.md D15) para superficies y controles con radio. Va en `style`
 * porque NativeWind no tiene clase para `borderCurve`; en web y Android no tiene efecto.
 */
export const CONTINUOUS_CURVE: ViewStyle = { borderCurve: "continuous" };
