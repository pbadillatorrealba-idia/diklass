import type { PropsWithChildren } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const WIDTHS = { content: "max-w-content", wide: "max-w-wide" } as const;

export type ScreenProps = PropsWithChildren<{
  className?: string;
  /** `content`: una columna de lectura; `wide`: la consulta a dos columnas (design.md D9). */
  width?: keyof typeof WIDTHS;
  scroll?: boolean;
  testID?: string;
}>;

/**
 * Contenedor de pantalla (FR-079 · design.md D7): área segura, desplazamiento, margen
 * adaptable (`p-4`, `md:p-6`) y ancho de lectura centrado. `className` ajusta solo el layout del
 * contenido y se aplica al final.
 */
export function Screen({
  children,
  className,
  scroll = true,
  testID,
  width = "content",
}: ScreenProps) {
  const content = (
    <View
      className={`w-full ${WIDTHS[width]} self-center gap-6 p-4 md:p-6 ${className ?? ""}`.trim()}
      testID={testID}
    >
      {children}
    </View>
  );
  return (
    // `style` y no `className`: NativeWind solo interpreta `className` en los componentes de RN.
    <SafeAreaView style={{ flex: 1 }}>
      {scroll ? (
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          testID={testID ? `${testID}-scroll` : undefined}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}
