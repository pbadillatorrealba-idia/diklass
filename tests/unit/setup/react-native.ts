import { mock } from "bun:test";
import { createElement, forwardRef } from "react";

// Global que Metro define en la app; lo leen @expo/vector-icons y otros paquetes de Expo.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

/**
 * Bun no puede importar `react-native` (su fuente usa Flow): las pruebas de componentes
 * renderizan con `react-native-web`, igual que la app en web (design.md D11). NativeWind no
 * transforma JSX en Bun, así que `className` se reexpone como `data-class` para poder comprobar
 * las variantes en el HTML.
 */
const withClass = (Component: unknown) =>
  forwardRef((props: { className?: string; dataSet?: object }, ref) =>
    createElement(Component as never, {
      ...props,
      ref,
      dataSet: { ...props.dataSet, class: props.className },
    }),
  );

mock.module("react-native", () => {
  const web = require("react-native-web");
  return {
    ...web,
    Pressable: withClass(web.Pressable),
    SafeAreaView: withClass(web.SafeAreaView),
    ScrollView: withClass(web.ScrollView),
    Text: withClass(web.Text),
    TextInput: withClass(web.TextInput),
    View: withClass(web.View),
  };
});

// `@expo/vector-icons` carga su fuente con expo-font, que necesita el runtime nativo de Expo;
// en las pruebas la fuente se da por cargada.
mock.module("expo-font", () => ({
  isLoaded: () => true,
  loadAsync: async () => {},
  useFonts: () => [true, null],
}));

// react-native-safe-area-context importa rutas internas de react-native (Flow): en las pruebas el
// área segura es una vista sin márgenes.
mock.module("react-native-safe-area-context", () => {
  const web = require("react-native-web");
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: { children?: unknown }) => children,
    SafeAreaView: withClass(web.View),
    useSafeAreaInsets: () => insets,
  };
});
