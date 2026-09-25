import { Text as RNText, type TextProps as RNTextProps } from "react-native";

/** Rampa con nombre (FR-074 · design.md D5): 14 px es el mínimo para metadatos clínicos. */
const VARIANTS = {
  body: "text-base",
  caption: "text-sm",
  label: "text-sm font-medium",
  strong: "text-base font-semibold",
} as const;

/** Un solo color de texto por tono; cada par está verificado AA en `tema.test.ts`. */
const TONES = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  destructive: "text-destructive",
  warning: "text-warning",
  success: "text-success",
  info: "text-info",
  /** Texto sobre un relleno sólido `destructive` (severidad crítica). */
  onDestructive: "text-destructive-foreground",
} as const;

/** @deprecated Usar `variant`; se retira al terminar la migración (tarea 6.3). */
const LEGACY_SIZES = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
} as const;

export type TextVariant = keyof typeof VARIANTS;
export type TextTone = keyof typeof TONES;

export type TextProps = RNTextProps & {
  className?: string;
  variant?: TextVariant;
  tone?: TextTone;
  /** @deprecated Usar `variant="strong"`. */
  bold?: boolean;
  /** @deprecated Usar `variant`. */
  size?: keyof typeof LEGACY_SIZES;
};

export function Text({
  bold = false,
  className,
  size,
  tone = "default",
  variant = "body",
  ...props
}: TextProps) {
  const scale = size ? LEGACY_SIZES[size] : VARIANTS[variant];
  return (
    <RNText
      className={`font-sans ${TONES[tone]} ${scale} ${bold ? "font-semibold" : ""} ${
        className ?? ""
      }`
        .replace(/\s+/g, " ")
        .trim()}
      {...props}
    />
  );
}
