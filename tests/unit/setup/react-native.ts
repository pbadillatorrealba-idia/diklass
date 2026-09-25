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

// `expo-router` arrastra el runtime nativo (splash, TurboModules). Las primitivas solo usan
// `Link`, `Stack.Screen` y `Head`: `Link` se renderiza como `<a>`, `Head` deja su contenido en el
// HTML y `Stack.Screen` guarda sus opciones en `globalThis.__stackScreenOptions`.
(globalThis as { __stackScreenOptions?: unknown[] }).__stackScreenOptions = [];
mock.module("expo-router", () => ({
  Link: ({ children, href, testID }: { children?: unknown; href: string; testID?: string }) =>
    createElement("a", { href, "data-testid": testID }, children as never),
  Stack: {
    Screen: ({ options }: { options: unknown }) => {
      (globalThis as { __stackScreenOptions?: unknown[] }).__stackScreenOptions?.push(options);
      return null;
    },
  },
}));
mock.module("expo-router/head", () => ({
  default: ({ children }: { children?: unknown }) =>
    createElement("head-mock", null, children as never),
}));

// `expo-secure-store` necesita el runtime nativo; en las pruebas es un almacén en memoria.
mock.module("expo-secure-store", () => {
  const data = new Map<string, string>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
    getItemAsync: async (key: string) => data.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      data.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      data.delete(key);
    },
  };
});
