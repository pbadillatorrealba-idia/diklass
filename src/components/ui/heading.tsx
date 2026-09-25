import { Text as RNText, type TextProps as RNTextProps } from "react-native";

/** Tres niveles (FR-074 · design.md D5): título de pantalla, sección y subsección. */
const LEVELS = {
  1: "text-2xl font-bold",
  2: "text-xl font-semibold",
  3: "text-lg font-semibold",
} as const;

/**
 * @deprecated Usar `level`; se retira al terminar la migración (tarea 6.3). Cada tamaño antiguo
 * conserva su aspecto y declara el nivel al que corresponde.
 */
const LEGACY_SIZES = {
  sm: { className: "text-lg font-bold", level: 3 },
  md: { className: "text-xl font-bold", level: 2 },
  lg: { className: "text-2xl font-bold", level: 2 },
  "2xl": { className: "text-3xl font-bold", level: 1 },
  "3xl": { className: "text-4xl font-bold", level: 1 },
} as const;

export type HeadingLevel = keyof typeof LEVELS;

export type HeadingProps = RNTextProps & {
  className?: string;
  level?: HeadingLevel;
  /** @deprecated Usar `level`. */
  size?: keyof typeof LEGACY_SIZES;
};

export function Heading({ className, level, size, ...props }: HeadingProps) {
  const legacy = size ? LEGACY_SIZES[size] : undefined;
  const resolved = level ?? legacy?.level ?? 2;
  return (
    <RNText
      accessibilityRole="header"
      aria-level={resolved}
      className={`font-sans text-foreground ${legacy?.className ?? LEVELS[resolved]} ${
        className ?? ""
      }`.trim()}
      role="heading"
      {...props}
    />
  );
}
