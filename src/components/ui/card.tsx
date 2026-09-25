import { View, type ViewProps } from "react-native";
import { CONTINUOUS_CURVE } from "./border-curve";

export type CardProps = ViewProps & { className?: string };

/**
 * Superficie de primer nivel (design.md D6/D7): borde, radio de control y padding de la escala.
 * El ritmo interno (`gap-*`) lo pone quien la usa. No se anida para filas de una lista: dentro de
 * una tarjeta se separa con `gap` y divisores.
 */
export function Card({ className, style, ...props }: CardProps) {
  return (
    <View
      className={`rounded-xl border border-border bg-card p-4 ${className ?? ""}`.trim()}
      style={[CONTINUOUS_CURVE, style]}
      {...props}
    />
  );
}
