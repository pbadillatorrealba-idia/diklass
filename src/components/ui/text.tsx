import { Text as RNText, type TextProps as RNTextProps } from "react-native";

/**
 * Rampa con nombre (FR-074 · design.md D5): 14 px es el mínimo para metadatos clínicos. Cada
 * variante fija su familia: la UI en `font-sans` y los datos en `font-mono` (D20).
 */
const VARIANTS = {
  body: "font-sans text-base",
  caption: "font-sans text-sm",
  label: "font-sans text-sm font-medium",
  strong: "font-sans text-base font-semibold",
  /** Solo para etiquetas de navegación (design.md D17). */
  nav: "font-sans text-nav font-medium",
  /** Datos del formulario (D20): número de consulta, fechas y horas, pesos, dosis y códigos. */
  data: "font-mono text-base tabular-nums",
  /** Rótulo preimpreso del formulario (D20); por defecto en la tinta `primary`. */
  rubric: "font-sans text-sm font-semibold uppercase tracking-wide",
} as const;

/** Un solo color de texto por tono; cada par está verificado AA en `tema.test.ts`. */
const TONES = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  destructive: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  info: "text-info",
  /** Enlaces en línea (`LinkText`), verificado AA sobre card y fondo como el botón `ghost`. */
  primary: "text-primary",
  /** Tinta del timbre de firma (D20); solo dentro de `SignatureStamp`. */
  stamp: "text-stamp",
  /** Marca de corrección (D20); solo en `CorrectionLine`. */
  correction: "text-correction",
  /** Texto sobre un relleno sólido `destructive` (severidad crítica). */
  onDestructive: "text-destructive-foreground",
} as const;

export type TextVariant = keyof typeof VARIANTS;
export type TextTone = keyof typeof TONES;

export type TextProps = RNTextProps & {
  className?: string;
  variant?: TextVariant;
  tone?: TextTone;
};

export function Text({ className, tone, variant = "body", ...props }: TextProps) {
  const color = TONES[tone ?? (variant === "rubric" ? "primary" : "default")];
  return (
    <RNText className={`${VARIANTS[variant]} ${color} ${className ?? ""}`.trim()} {...props} />
  );
}
