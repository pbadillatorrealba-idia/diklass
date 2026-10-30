import { View } from "react-native";
import { Text } from "./text";

// Títulos que no cuentan para las iniciales.
const TITLES = new Set(["dr", "dra", "dr.", "dra."]);

/** Primera letra de las dos primeras palabras del nombre, sin títulos (design.md D17). */
export function initialsOf(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word && !TITLES.has(word.toLowerCase()));
  const initials = words
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase("es"))
    .join("");
  return initials || "?";
}

export type AvatarProps = { name: string; size?: "md" | "lg" };

const SIZES = { md: "min-h-touch min-w-touch", lg: "min-h-16 min-w-16" } as const;

/**
 * Marcador de la foto del profesional (FR-092): iniciales en `foreground` sobre `primary-surface`
 * (`primary` no llega a 4.5:1 sobre esa superficie en claro). Es decorativo:
 * el nombre siempre acompaña como texto o como nombre accesible del control que lo contiene.
 */
export function Avatar({ name, size = "md" }: AvatarProps) {
  return (
    <View
      aria-hidden
      className={`${SIZES[size]} items-center justify-center rounded-full bg-primary-surface`}
      importantForAccessibility="no-hide-descendants"
    >
      <Text variant="strong">{initialsOf(name)}</Text>
    </View>
  );
}
