import { Link, Stack } from "expo-router";
import Head from "expo-router/head";
import type { PropsWithChildren } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heading } from "./heading";
import { Text } from "./text";

const WIDTHS = { content: "max-w-content", wide: "max-w-wide" } as const;

export type ScreenProps = PropsWithChildren<{
  className?: string;
  /** `content`: una columna de lectura; `wide`: la consulta a dos columnas (design.md D9). */
  width?: keyof typeof WIDTHS;
  scroll?: boolean;
  testID?: string;
  /** Título de la pantalla: en web, `h1` + `<title>`; en nativo, la cabecera del `Stack`. */
  title?: string;
  /**
   * Retroceso explícito de las pantallas de detalle (FR-083): en web, un enlace «‹ Volver a …»;
   * en nativo lo da la cabecera. `href` es fijo para que funcione al entrar por URL directa.
   */
  back?: { href: string; label: string };
}>;

/**
 * Contenedor de pantalla (FR-079 · design.md D7): área segura, desplazamiento, margen
 * adaptable (`p-4`, `md:p-6`) y ancho de lectura centrado. `className` ajusta solo el layout del
 * contenido y se aplica al final.
 */
export function Screen({
  back,
  children,
  className,
  scroll = true,
  testID,
  title,
  width = "content",
}: ScreenProps) {
  const isWeb = process.env.EXPO_OS === "web";
  const content = (
    <View
      className={`w-full ${WIDTHS[width]} self-center gap-6 p-4 md:p-6 ${className ?? ""}`.trim()}
      testID={testID}
    >
      {isWeb && (back || title) ? (
        <View className="gap-2">
          {back ? (
            <Link href={back.href as never} testID="screen-back">
              <Text tone="muted" variant="label">
                ‹ Volver a {back.label}
              </Text>
            </Link>
          ) : null}
          {title ? <Heading level={1}>{title}</Heading> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    // `style` y no `className`: NativeWind solo interpreta `className` en los componentes de RN.
    // Con cabecera nativa (`title` fuera de web), la cabecera ya ocupa el borde superior.
    <SafeAreaView edges={title && !isWeb ? ["left", "right"] : undefined} style={{ flex: 1 }}>
      {title ? (
        isWeb ? (
          <Head>
            <title>{`${title} · Diklass`}</title>
          </Head>
        ) : (
          <Stack.Screen options={{ title }} />
        )
      ) : null}
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentInsetAdjustmentBehavior="automatic"
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
