import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Text } from "react-native";
import { ScreenList } from "@/components/ui/screen";

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

  test("sin datos pinta el vacío dentro de la lista", () => {
    const html = render([]);
    expect(html).toContain('data-testid="pacientes-list"');
    expect(html.indexOf('data-testid="lista-vacia"')).toBeGreaterThan(
      html.indexOf('data-testid="pacientes-list"'),
    );
    expect(html).not.toContain('data-testid="fila"');
  });
});
