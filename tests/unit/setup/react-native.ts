import { mock } from "bun:test";
import { createElement, forwardRef } from "react";

/**
 * Bun no puede importar `react-native` (su fuente usa Flow): las pruebas de componentes
 * renderizan con `react-native-web`, igual que la app en web (design.md D11). NativeWind no
 * transforma JSX en Bun, así que `className` se reexpone como `data-class` para poder comprobar
 * las variantes en el HTML.
 */
mock.module("react-native", () => {
  const web = require("react-native-web");
  const withClass = (Component: unknown) =>
    forwardRef((props: { className?: string; dataSet?: object }, ref) =>
      createElement(Component as never, {
        ...props,
        ref,
        dataSet: { ...props.dataSet, class: props.className },
      }),
    );
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
