import { Text as RNText, type TextProps as RNTextProps } from "react-native";

/** Tres niveles (FR-074 · design.md D5): título de pantalla, sección y subsección. */
const LEVELS = {
  1: "text-2xl font-bold",
  2: "text-xl font-semibold",
  3: "text-lg font-semibold",
} as const;

export type HeadingLevel = keyof typeof LEVELS;

export type HeadingProps = RNTextProps & {
  className?: string;
  level?: HeadingLevel;
};

export function Heading({ className, level = 2, ...props }: HeadingProps) {
  return (
    <RNText
      accessibilityRole="header"
      aria-level={level}
      className={`font-sans text-foreground ${LEVELS[level]} ${className ?? ""}`.trim()}
      role="heading"
      {...props}
    />
  );
}
