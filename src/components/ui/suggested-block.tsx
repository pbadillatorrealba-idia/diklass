import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { CONTINUOUS_CURVE } from "./border-curve";

/** D20: la copia canaria todavía no está firmada; la etiqueta visible es también el nombre. */
const LABEL = "Sugerencia del sistema · copia sin firmar";

export type SuggestedBlockProps = PropsWithChildren<{ className?: string; testID?: string }>;

/**
 * Contenido generado por el sistema y aún no validado por un profesional (FR-076 · design.md D7):
 * pliego `suggested-surface` con contorno de 1 px `suggested` (D20) y la etiqueta visible como primer hijo, para que se lea antes que el
 * contenido en todas las plataformas. Al aprobarse, el contenido deja este bloque y muestra su
 * atribución.
 */
export function SuggestedBlock({ children, className, testID }: SuggestedBlockProps) {
  return (
    <View
      accessibilityLabel={LABEL}
      aria-label={LABEL}
      className={`gap-1 rounded-sm border border-suggested bg-suggested-surface p-3 ${className ?? ""}`.trim()}
      role="group"
      style={CONTINUOUS_CURVE}
      testID={testID}
    >
      <View className="flex-row items-center gap-1">
        <Icon decorative name="robot-outline" size="sm" tone="muted-foreground" />
        <Text tone="muted" variant="label">
          {LABEL}
        </Text>
      </View>
      {children}
    </View>
  );
}
