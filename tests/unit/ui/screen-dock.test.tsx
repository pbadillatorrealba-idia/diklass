import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Text } from "react-native";
import { Screen, ScreenList } from "@/components/ui/screen";
import { DockProvider } from "@/features/asistente/panel-dock";

// Los dobles de `expo-router` viven en `tests/unit/setup/react-native.ts`: en nativo `Screen` deja
// su título en la cabecera del `Stack` simulado, que es global y se limpia entre pruebas.
const stackOptions =
  (globalThis as { __stackScreenOptions?: unknown[] }).__stackScreenOptions ?? [];

const ORIGINAL_OS = process.env.EXPO_OS;
afterEach(() => {
  process.env.EXPO_OS = ORIGINAL_OS;
  stackOptions.length = 0;
});

const dock = <Text testID="dock-contenido">Escucha activa</Text>;
const accion = <Text testID="accion-principal">Guardar</Text>;

/** Marcado desde el contenedor de la barra al pie hasta el final. */
const barra = (html: string) => html.slice(html.indexOf('data-testid="screen-action-bar"'));

// sistema-visual «Dock de asistente en compacto» (shell-asistente-tres-zonas, design.md D7): la
// cinta se pinta en el contenedor de la barra al pie de `Screen`, dentro del área segura, a
// cualquier ancho.
describe("Screen con dock", () => {
  test.each(["web", "ios", "android"])("el dock se pinta en la barra al pie (%s)", (os) => {
    process.env.EXPO_OS = os;
    const html = renderToStaticMarkup(<Screen dock={dock} title="Pacientes" />);
    expect(html).toContain('data-testid="screen-action-bar"');
    expect(barra(html)).toContain('data-testid="screen-dock"');
    expect(barra(html)).toContain("Escucha activa");
  });

  test("va después del contenido y fuera del desplazamiento, como la barra de acción", () => {
    process.env.EXPO_OS = "web";
    const html = renderToStaticMarkup(
      <Screen dock={dock} testID="pantalla" title="Pacientes">
        <Text>Contenido</Text>
      </Screen>,
    );
    expect(html.indexOf("Contenido")).toBeLessThan(html.indexOf('data-testid="screen-dock"'));
    // La barra no está dentro del `ScrollView`: es hermana suya.
    expect(html.indexOf('data-testid="screen-action-bar"')).toBeGreaterThan(
      html.indexOf('data-testid="pantalla-scroll"'),
    );
  });

  test("comparte contenedor con la acción principal: una sola barra, la acción primero", () => {
    process.env.EXPO_OS = "ios";
    const html = renderToStaticMarkup(<Screen action={accion} dock={dock} title="Pacientes" />);
    expect(html.match(/data-testid="screen-action-bar"/g)).toHaveLength(1);
    expect(barra(html).indexOf("Guardar")).toBeLessThan(barra(html).indexOf("Escucha activa"));
  });

  test("a todo el ancho: el dock sigue en la barra aunque la acción vaya en la cabecera", () => {
    process.env.EXPO_OS = "web";
    const html = renderToStaticMarkup(<Screen action={accion} dock={dock} title="Pacientes" />);
    expect(barra(html)).toContain("Escucha activa");
  });

  test("el dock viene del contexto del shell si la pantalla no lo pasa", () => {
    process.env.EXPO_OS = "ios";
    const html = renderToStaticMarkup(
      <DockProvider value={dock}>
        <Screen title="Pacientes" />
      </DockProvider>,
    );
    expect(barra(html)).toContain("Escucha activa");
  });

  test("sin dock ni acción no hay barra (sin regresiones)", () => {
    process.env.EXPO_OS = "ios";
    const html = renderToStaticMarkup(<Screen title="Pacientes" />);
    expect(html).not.toContain('data-testid="screen-action-bar"');
    expect(html).not.toContain('data-testid="screen-dock"');
  });

  test("una pantalla con acción conserva su barra sin dock", () => {
    process.env.EXPO_OS = "ios";
    const html = renderToStaticMarkup(<Screen action={accion} title="Pacientes" />);
    expect(barra(html)).toContain("Guardar");
    expect(html).not.toContain('data-testid="screen-dock"');
  });

  test("las listas también muestran el dock", () => {
    process.env.EXPO_OS = "ios";
    const html = renderToStaticMarkup(
      <ScreenList
        data={[]}
        dock={dock}
        empty={<Text>Vacío</Text>}
        keyExtractor={() => "x"}
        renderItem={() => <Text>fila</Text>}
        testID="lista"
        title="Pacientes"
      />,
    );
    expect(barra(html)).toContain("Escucha activa");
  });
});
