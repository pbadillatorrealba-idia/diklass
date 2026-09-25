import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import type { ThemeToken } from "@/theme/colors";
import { useThemeColors } from "@/theme/use-theme-colors";

const SIZES = { sm: 16, md: 20, lg: 24 } as const;

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/**
 * Un icono informa (con `label`, se anuncia como imagen) o decora (con `decorative`, queda oculto
 * a los lectores de pantalla); los tipos no admiten ninguno ni ambos (FR-078 · design.md D8).
 */
export type IconProps = {
  name: IconName;
  size?: keyof typeof SIZES;
  /** El color sale del tema: la librería de iconos lo recibe por prop, no por `className`. */
  tone?: ThemeToken;
} & ({ label: string; decorative?: never } | { decorative: true; label?: never });

export function Icon({ name, size = "md", tone = "foreground", label, decorative }: IconProps) {
  const colors = useThemeColors();
  const accessibility = decorative
    ? {
        accessible: false,
        "aria-hidden": true,
        importantForAccessibility: "no-hide-descendants" as const,
      }
    : {
        accessibilityLabel: label,
        accessibilityRole: "image" as const,
        accessible: true,
        role: "img" as const,
      };
  return (
    <MaterialCommunityIcons
      color={colors[tone]}
      name={name}
      size={SIZES[size]}
      {...accessibility}
    />
  );
}
