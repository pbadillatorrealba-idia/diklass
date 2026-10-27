import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Text } from "react-native";
import { listColumns, ScreenList } from "@/components/ui/screen";
import { contentWidthFor } from "@/features/asistente/panel-store";

const ORIGINAL_OS = process.env.EXPO_OS;
afterEach(() => {
  process.env.EXPO_OS = ORIGINAL_OS;
});

const pacientes = Array.from({ length: 200 }, (_, i) => ({ id: `p${i}`, name: `Paciente ${i}` }));

// sistema-visual FR-086 · design.md D13: las listas no acotadas son un `FlatList` que es el único
// contenedor de desplazamiento; la cabecera (título y acciones) y el vacío viven dentro de él.
describe("ScreenList", () => {
  const render = (data: typeof pacientes) =>
    renderToStaticMarkup(
      <ScreenList
        data={data}
        empty={<Text testID="lista-vacia">Sin pacientes</Text>}
        header={<Text testID="accion">Registrar paciente</Text>}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text testID="fila">{item.name}</Text>}
        testID="pacientes-list"
        title="Pacientes"
      />,
    );

  test("no pinta las 200 filas a la vez", () => {
    const filas = render(pacientes).match(/data-testid="fila"/g) ?? [];
    expect(filas.length).toBeGreaterThan(0);
    expect(filas.length).toBeLessThan(200);
  });

  test("en web el título y las acciones van dentro de la lista, antes de las filas", () => {
    process.env.EXPO_OS = "web";
    const html = render(pacientes);
    const lista = html.indexOf('data-testid="pacientes-list"');
    expect(lista).toBeGreaterThan(-1);
    const titulo = html.search(/aria-level="1"[^>]*>Pacientes</);
    expect(titulo).toBeGreaterThan(lista);
    expect(html.indexOf('data-testid="accion"')).toBeGreaterThan(titulo);
    expect(html.indexOf('data-testid="fila"')).toBeGreaterThan(
      html.indexOf('data-testid="accion"'),
    );
    expect(html).toContain("<title>Pacientes · Diklass</title>");
  });

  test("no anida otro contenedor de desplazamiento", () => {
    expect(render(pacientes)).not.toContain("pacientes-scroll");
  });

  test("ajusta el contenido al teclado de iOS", () => {
    expect(render(pacientes)).toContain('data-keyboard-insets="true"');
  });

  test("sin datos pinta el vacío dentro de la lista", () => {
    const html = render([]);
    expect(html).toContain('data-testid="pacientes-list"');
    expect(html.indexOf('data-testid="lista-vacia"')).toBeGreaterThan(
      html.indexOf('data-testid="pacientes-list"'),
    );
    expect(html).not.toContain('data-testid="fila"');
  });

  test("pinta el formulario después de las filas dentro del mismo desplazamiento", () => {
    const html = renderToStaticMarkup(
      <ScreenList
        data={pacientes}
        empty={<Text>Sin pacientes</Text>}
        footer={<Text testID="formulario">Registrar evolución</Text>}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text testID="fila">{item.name}</Text>}
        testID="pacientes-list"
      />,
    );
    expect(html.indexOf('data-testid="formulario"')).toBeGreaterThan(
      html.indexOf('data-testid="fila"'),
    );
  });

  // design.md D18: listas a lo ancho del escritorio, en 2 columnas desde 1280 px de ventana.
  test("width=wide usa el ancho de escritorio; por defecto, el de lectura", () => {
    const clase = (html: string) => html.match(/data-content-class="([^"]*)"/)?.[1] ?? "";
    expect(clase(render(pacientes))).toContain("max-w-content");
    const ancho = renderToStaticMarkup(
      <ScreenList
        data={pacientes}
        empty={<Text>Sin pacientes</Text>}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text>{item.name}</Text>}
        testID="pacientes-list"
        width="wide"
      />,
    );
    expect(clase(ancho)).toContain("max-w-wide");
  });

  // El segundo argumento es el ancho del contenido, no el de la ventana (sistema-visual
  // «Shell de tres zonas»): con el panel acoplado el contenido es más estrecho que la ventana.
  test.each([
    ["content", 1200, 1],
    ["wide", 959, 1],
    ["wide", 960, 2],
    ["wide", 1320, 2],
  ] as const)("con width=%s y contenido de %d px van %d columnas", (width, contenido, columnas) => {
    expect(listColumns(width, contenido)).toBe(columnas);
  });

  test.each([
    // [ventana, panel expandido, ancho del contenido, columnas de una lista wide]
    [1280, true, 984, 2], // riel: el panel no quita ancho al contenido más allá de 56 px
    [1440, true, 840, 1], // panel acoplado: el contenido es más estrecho que la ventana
    [1440, false, 1144, 2], // panel colapsado a riel
    [1920, true, 1320, 2],
    [1024, true, 728, 1],
    [375, true, 375, 1], // dock: sin barra lateral ni columna del panel
  ] as const)(
    "ventana de %d px (expandido=%s) → contenido %d px",
    (ventana, expandido, contenido, columnas) => {
      expect(contentWidthFor(ventana, expandido)).toBe(contenido);
      expect(listColumns("wide", contentWidthFor(ventana, expandido))).toBe(columnas);
    },
  );
});
