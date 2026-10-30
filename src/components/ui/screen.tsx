import { type Href, Link, Stack } from "expo-router";
import Head from "expo-router/head";
import { type PropsWithChildren, type ReactElement, type ReactNode, useState } from "react";
import { FlatList, type FlatListProps, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDock } from "@/features/asistente/panel-dock";
import { useContentWidth } from "@/features/asistente/use-content-width";
import { Heading } from "./heading";
import { Logo } from "./logo";
import { Text } from "./text";

const WIDTHS = { content: "max-w-content", wide: "max-w-wide" } as const;

export type ScreenProps = PropsWithChildren<{
  className?: string;
  /** `content`: una columna de lectura; `wide`: consulta, listas y paneles (design.md D9, D18). */
  width?: keyof typeof WIDTHS;
  testID?: string;
  /** Título de la pantalla: en web, `h1` + `<title>`; en nativo, la cabecera del `Stack`. */
  title?: string;
  /** Línea breve sobre el `h1` (p. ej. «Hola,»). Solo en web: en nativo la cabecera lleva el título. */
  pretitle?: string;
  /**
   * Acción principal de la pantalla: en web desde 768 px, en la línea del `h1`; en nativo y en
   * ventanas estrechas, en una barra fija al pie a todo el ancho.
   */
  action?: ReactNode;
  /**
   * Cinta del asistente al pie (sistema-visual «Dock de asistente en compacto»). Sin pasarla, la
   * pantalla toma la del shell (`DockProvider`); sin dock en el shell no hay cinta.
   */
  dock?: ReactNode;
  /**
   * Retroceso explícito de las pantallas de detalle (FR-083): en web, un enlace «‹ Volver a …»;
   * en nativo lo da la cabecera. `href` es fijo para que funcione al entrar por URL directa.
   */
  back?: {
    href: Href;
    label: string;
    /**
     * Ruta de ancestros (de la raíz al padre) para el breadcrumb de escritorio; sin ella se usa
     * solo el padre con `label`. En pantallas pequeñas siempre se ve «‹ Volver a …».
     */
    crumbs?: { href: Href; label: string }[];
  };
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

/** Ventana desde la que el retroceso de web pasa a ser un breadcrumb (`lg`). */
const BREADCRUMB_FROM = 1024;

/** Ventana bajo la que la acción principal pasa a una barra fija al pie (`md`). */
const ACTION_BAR_BELOW = 768;

/** Nativo y web estrecho: la acción principal va en una barra fija al pie, al alcance del pulgar. */
function useActionBar() {
  const width = useWindowDimensions().width;
  return process.env.EXPO_OS !== "web" || width < ACTION_BAR_BELOW;
}

/**
 * Barra fija al pie, fuera del desplazamiento (FR-088 · design.md D7): la acción principal en
 * compacto y, a cualquier ancho, la cinta del asistente. La acción mantiene borde y fondo `card`; el
 * dock se superpone al contenido, que añade su altura al padding final para dejar accesibles los
 * últimos controles. `SafeAreaView` mide su solape con el indicador de inicio
 * o la barra de gestos; en iOS/Android queda sobre `NativeTabs` y en web sobre la barra inferior.
 */
function ScreenBottomBar({
  action,
  dock,
  width,
  onHeightChange,
}: {
  onHeightChange: (height: number) => void;
  action: ReactNode;
  dock: ReactNode;
  width: keyof typeof WIDTHS;
}) {
  if (!(action || dock)) return null;
  return (
    <View
      className="absolute bottom-0 left-0 right-0 z-10"
      onLayout={(event) => onHeightChange(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
      testID="screen-action-bar"
    >
      <SafeAreaView edges={["bottom"]} pointerEvents="box-none">
        {action ? (
          <View className="border-t border-border bg-card">
            <View className={`w-full ${WIDTHS[width]} self-center p-4`}>{action}</View>
          </View>
        ) : null}
        {dock ? (
          <View pointerEvents="box-none" testID="screen-dock">
            {dock}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

/** En web, «‹ Volver a …» (o, desde `lg`, el breadcrumb) y el `h1`; en nativo, la cabecera. */
function ScreenHeading({
  action,
  back,
  pretitle,
  title,
}: Pick<ScreenProps, "action" | "back" | "pretitle" | "title">) {
  const isWide = useWindowDimensions().width >= BREADCRUMB_FROM;
  if (process.env.EXPO_OS !== "web") return null;
  const crumbs = back ? (back.crumbs ?? [{ href: back.href, label: back.label }]) : [];
  return (
    <View className="gap-2">
      <View className="mb-4 items-center pt-2 lg:hidden" testID="screen-brand">
        <Logo size="sm" />
      </View>
      {back && isWide ? (
        <View role="navigation" aria-label="Ruta" className="flex-row flex-wrap gap-2">
          {crumbs.map((crumb, index) => (
            <View className="flex-row gap-2" key={String(crumb.href)}>
              <Link
                href={crumb.href}
                testID={index === crumbs.length - 1 ? "screen-back" : `screen-crumb-${index}`}
              >
                <Text tone="muted" variant="label">
                  {crumb.label}
                </Text>
              </Link>
              <Text aria-hidden tone="muted" variant="label">
                ›
              </Text>
            </View>
          ))}
          <Text aria-current="page" variant="label">
            {title}
          </Text>
        </View>
      ) : back ? (
        <Link href={back.href} testID="screen-back">
          <Text tone="muted" variant="label">
            ‹ Volver a {back.label}
          </Text>
        </Link>
      ) : null}
      {title || action ? (
        <View className="flex-row flex-wrap items-center justify-between gap-3">
          {title ? (
            <View className="min-w-0 shrink">
              {pretitle ? <Text tone="muted">{pretitle}</Text> : null}
              <Heading level={1}>{title}</Heading>
            </View>
          ) : (
            <View />
          )}
          {action}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Contenedor de pantalla (FR-079 · design.md D7): área segura, desplazamiento, margen
 * adaptable (`p-4`, `md:p-6`) y ancho de lectura centrado. `className` ajusta solo el layout del
 * contenido y se aplica al final.
 */
export function Screen({
  action,
  back,
  children,
  dock: dockProp,
  className,
  pretitle,
  testID,
  title,
  width = "content",
}: ScreenProps) {
  const actionBar = useActionBar();
  const shellDock = useDock();
  const dock = dockProp ?? shellDock;
  const [bottomHeight, setBottomHeight] = useState(0);
  const content = (
    <View
      className={`w-full ${WIDTHS[width]} self-center gap-6 p-4 md:p-6 ${className ?? ""}`.trim()}
      testID={testID}
    >
      <ScreenHeading
        action={actionBar ? null : action}
        back={back}
        pretitle={pretitle}
        title={title}
      />
      {children}
    </View>
  );
  return (
    <ScreenFrame title={title}>
      {/* FR-088 · design.md D14: iOS ajusta los insets al teclado (sin desfase por la cabecera
          nativa); Android ya redimensiona la ventana (`softwareKeyboardLayoutMode`, `resize`). */}
      <ScrollView
        automaticallyAdjustKeyboardInsets
        className="flex-1"
        contentContainerStyle={{ paddingBottom: dock || (actionBar && action) ? bottomHeight : 0 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        testID={testID ? `${testID}-scroll` : undefined}
      >
        {content}
      </ScrollView>
      <ScreenBottomBar
        action={actionBar ? action : null}
        dock={dock}
        width={width}
        onHeightChange={setBottomHeight}
      />
    </ScreenFrame>
  );
}

/**
 * Ancho de contenido a partir del cual una lista `wide` va a 2 columnas (design.md D18). Es el
 * contenido que deja la ventana de 1280 px (`xl`) con la barra lateral y el riel del panel.
 */
const TWO_COLUMNS_FROM = 960;

/** Columnas de una `ScreenList` según su ancho y el ancho del contenido, no el de la ventana. */
export function listColumns(width: keyof typeof WIDTHS, contentWidth: number) {
  return width === "wide" && contentWidth >= TWO_COLUMNS_FROM ? 2 : 1;
}

export type ScreenListProps<T> = Pick<ScreenProps, "back" | "title" | "width"> &
  Pick<FlatListProps<T>, "data" | "keyExtractor" | "renderItem"> & {
    /** Acciones y textos bajo el título, dentro de la lista. */
    header?: ReactNode;
    /** Contenido después de las filas, dentro del mismo desplazamiento. */
    footer?: ReactElement;
    /** Lo que se pinta sin filas: carga, error o vacío (`QueryState`). */
    empty: ReactElement;
    /** Cinta del asistente al pie; sin pasarla se toma la del shell (ver `ScreenProps.dock`). */
    dock?: ReactNode;
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
  dock: dockProp,
  empty,
  footer,
  header,
  keyExtractor,
  renderItem,
  testID,
  title,
  width = "content",
}: ScreenListProps<T>) {
  const columns = listColumns(width, useContentWidth());
  const shellDock = useDock();
  const dock = dockProp ?? shellDock;
  const [bottomHeight, setBottomHeight] = useState(0);
  return (
    <ScreenFrame title={title}>
      <FlatList
        automaticallyAdjustKeyboardInsets
        className="flex-1"
        // `columnWrapperClassName` solo existe con más de una columna.
        columnWrapperClassName={columns > 1 ? "gap-3" : undefined}
        contentContainerClassName={`w-full ${WIDTHS[width]} self-center gap-3 p-4 md:p-6`}
        contentContainerStyle={{ paddingBottom: dock ? bottomHeight : 0 }}
        contentInsetAdjustmentBehavior="automatic"
        data={data}
        keyboardShouldPersistTaps="handled"
        keyExtractor={keyExtractor}
        // RN no admite cambiar `numColumns` en caliente: otra clave monta una lista nueva.
        key={columns}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
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
      <ScreenBottomBar action={null} dock={dock} width={width} onHeightChange={setBottomHeight} />
    </ScreenFrame>
  );
}
