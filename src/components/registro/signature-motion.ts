import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

/** Duración de la firma (FR-099 · design.md D20): un solo movimiento de ≤ 300 ms. */
export const SIGNATURE_MS = 240;

// `backgroundColor` no admite el driver nativo; la opacidad y la escala, sí.
const useNativeDriver = process.env.EXPO_OS !== "web";

/**
 * Salida exponencial (easeOutExpo) como curva de Bézier: termina exactamente en 1.
 * `Easing.out(Easing.exp)` se queda en 1 − 2⁻¹⁰ y dejaba el timbre en opacidad 0.999 y el
 * pliego en 0.001 (revisión de la PR #41).
 */
export const SIGNATURE_EASING = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * Firma de la epicrisis (FR-099 · D20): al aprobar, el pliego canario de la sección 3 se funde a
 * papel y el timbre entra con una ligera escala (0.96 → 1) y opacidad, en un solo movimiento con
 * salida exponencial. Con Reduce Motion (en web, `prefers-reduced-motion`) el cambio es inmediato.
 *
 * `paper` es la opacidad del pliego (1 mientras hay borrador). `prepare()` se llama justo antes de
 * aprobar: deja el timbre en su estado inicial para que no se pinte completo antes de animarse.
 */
export function useSignatureMotion(isSuggested: boolean) {
  const paper = useRef(new Animated.Value(isSuggested ? 1 : 0)).current;
  const stamp = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) reduceMotion.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      reduceMotion.current = enabled;
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isSuggested) {
      paper.setValue(1);
      return;
    }
    if (!pending.current || reduceMotion.current) {
      pending.current = false;
      paper.setValue(0);
      stamp.setValue(1);
      return;
    }
    pending.current = false;
    const easing = SIGNATURE_EASING;
    Animated.parallel([
      Animated.timing(paper, { toValue: 0, duration: SIGNATURE_MS, easing, useNativeDriver }),
      Animated.timing(stamp, { toValue: 1, duration: SIGNATURE_MS, easing, useNativeDriver }),
    ]).start();
  }, [isSuggested, paper, stamp]);

  const prepare = () => {
    if (reduceMotion.current) return;
    pending.current = true;
    stamp.setValue(0);
  };

  // Un solo nodo interpolado: recrearlo en cada render lo re-engancharía a mitad de la firma.
  const stampStyle = useMemo(
    () => ({
      opacity: stamp,
      transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }],
    }),
    [stamp],
  );
  return { paper, stampStyle, prepare };
}
