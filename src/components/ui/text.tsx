import { Text as RNText, type TextProps as RNTextProps } from "react-native";

/** Rampa con nombre (FR-074 · design.md D5): 14 px es el mínimo para metadatos clínicos. */
const VARIANTS = {
  body: "text-base",
  caption: "text-sm",
  label: "text-sm font-medium",
  strong: "text-base font-semibold",
  /** Solo para etiquetas de navegación (design.md D17). */
  nav: "text-nav font-medium",
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

export function Text({ className, tone = "default", variant = "body", ...props }: TextProps) {
  return (
    <RNText
      className={`font-sans ${TONES[tone]} ${VARIANTS[variant]} ${className ?? ""}`.trim()}
      {...props}
    />
  );
}
