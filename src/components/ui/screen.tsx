import { Link, Stack } from "expo-router";
import Head from "expo-router/head";
import type { PropsWithChildren, ReactElement, ReactNode } from "react";
import {
  FlatList,
  type FlatListProps,
  KeyboardAvoidingView,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heading } from "./heading";
import { Text } from "./text";

const WIDTHS = { content: "max-w-content", wide: "max-w-wide" } as const;

export type ScreenProps = PropsWithChildren<{
  className?: string;
  /** `content`: una columna de lectura; `wide`: consulta, listas y paneles (design.md D9, D18). */
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

type FrameProps = PropsWithChildren<Pick<ScreenProps, "title">>;

/** Área segura y título del documento (web) o de la cabecera nativa. */
function ScreenFrame({ children, title }: FrameProps) {
  const isWeb = process.env.EXPO_OS === "web";
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
      {children}
    </SafeAreaView>
  );
}

/** En web, «‹ Volver a …» y el `h1`; en nativo los da la cabecera del `Stack`. */
function ScreenHeading({ back, title }: Pick<ScreenProps, "back" | "title">) {
  if (process.env.EXPO_OS !== "web" || !(back || title)) return null;
  return (
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
  );
}

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
  const content = (
    <View
      className={`w-full ${WIDTHS[width]} self-center gap-6 p-4 md:p-6 ${className ?? ""}`.trim()}
      testID={testID}
    >
      <ScreenHeading back={back} title={title} />
      {children}
    </View>
  );
  return (
    <ScreenFrame title={title}>
      {scroll ? (
        // FR-088 · design.md D14: en iOS el teclado empuja el contenido; Android ya redimensiona
        // la ventana (`softwareKeyboardLayoutMode`, `resize` por defecto en Expo).
        <KeyboardAvoidingView
          behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            className="flex-1"
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
            testID={testID ? `${testID}-scroll` : undefined}
          >
            {content}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </ScreenFrame>
  );
}

/** Ventana a partir de la cual una lista `wide` va a 2 columnas (`xl`, design.md D18). */
const TWO_COLUMNS_FROM = 1280;

/** Columnas de una `ScreenList` según su ancho y la ventana (design.md D18). */
export function listColumns(width: keyof typeof WIDTHS, windowWidth: number) {
  return width === "wide" && windowWidth >= TWO_COLUMNS_FROM ? 2 : 1;
}

export type ScreenListProps<T> = Pick<ScreenProps, "back" | "title" | "width"> &
  Pick<FlatListProps<T>, "data" | "keyExtractor" | "renderItem"> & {
    /** Acciones y textos bajo el título, dentro de la lista. */
    header?: ReactNode;
    /** Lo que se pinta sin filas: carga, error o vacío (`QueryState`). */
    empty: ReactElement;
    testID: string;
  };

/**
 * Pantalla de lista no acotada (FR-086 · design.md D13): el `FlatList` es el único contenedor de
 * desplazamiento, con el título y las acciones en `ListHeaderComponent` y el vacío en
 * `ListEmptyComponent`. Mismo ancho de lectura y margen que `Screen`.
 */
export function ScreenList<T>({
  back,
  data,
  empty,
  header,
  keyExtractor,
  renderItem,
  testID,
  title,
  width = "content",
}: ScreenListProps<T>) {
  const columns = listColumns(width, useWindowDimensions().width);
  return (
    <ScreenFrame title={title}>
      <FlatList
        className="flex-1"
        // `columnWrapperClassName` solo existe con más de una columna.
        columnWrapperClassName={columns > 1 ? "gap-3" : undefined}
        contentContainerClassName={`w-full ${WIDTHS[width]} self-center gap-3 p-4 md:p-6`}
        contentInsetAdjustmentBehavior="automatic"
        data={data}
        keyboardShouldPersistTaps="handled"
        keyExtractor={keyExtractor}
        // RN no admite cambiar `numColumns` en caliente: otra clave monta una lista nueva.
        key={columns}
        ListEmptyComponent={empty}
        ListHeaderComponent={
          <View className="gap-6 pb-3">
            <ScreenHeading back={back} title={title} />
            {header}
          </View>
        }
        numColumns={columns}
        // En filas de varias columnas, cada tarjeta se reparte el ancho de la fila.
        renderItem={
          columns > 1 && renderItem
            ? (info) => <View className="flex-1">{renderItem(info)}</View>
            : renderItem
        }
        testID={testID}
      />
    </ScreenFrame>
  );
}
