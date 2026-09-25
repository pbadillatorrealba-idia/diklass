import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { CONTINUOUS_CURVE } from "./border-curve";

const LABEL = "Sugerencia del sistema";

export type SuggestedBlockProps = PropsWithChildren<{ className?: string; testID?: string }>;

/**
 * Contenido generado por el sistema y aún no validado por un profesional (FR-076 · design.md D7):
 * borde lateral `suggested` y la etiqueta visible como primer hijo, para que se lea antes que el
 * contenido en todas las plataformas. Al aprobarse, el contenido deja este bloque y muestra su
 * atribución.
 */
export function SuggestedBlock({ children, className, testID }: SuggestedBlockProps) {
  return (
    <View
      accessibilityLabel={LABEL}
      aria-label={LABEL}
      className={`gap-1 border-l-4 border-suggested pl-3 ${className ?? ""}`.trim()}
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
