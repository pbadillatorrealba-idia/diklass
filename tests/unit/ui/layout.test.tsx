import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Text } from "react-native";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";

const tagWith = (html: string, needle: string) =>
  html.match(new RegExp(`<[^>]*${needle}[^>]*>`))?.[0] ?? "";

// FR-079 · FR-081 · design.md D6/D7/D9.
describe("Screen", () => {
  test("ocupa la pantalla, limita el ancho de lectura y usa el margen adaptable", () => {
    const html = renderToStaticMarkup(
      <Screen testID="pantalla">
        <Text>hola</Text>
      </Screen>,
    );
    const content = tagWith(html, 'data-testid="pantalla"');
    expect(content).toContain("max-w-content");
    expect(content).toContain("self-center");
    expect(content).toContain("p-4");
    expect(content).toContain("md:p-6");
    expect(content).toContain("gap-6");
    expect(html).toContain("flex-1");
  });

  test("width=wide usa el ancho de la consulta a dos columnas", () => {
    const html = renderToStaticMarkup(<Screen testID="pantalla" width="wide" />);
    expect(tagWith(html, 'data-testid="pantalla"')).toContain("max-w-wide");
  });

  test("con scroll (por defecto) el contenido va dentro de un área desplazable", () => {
    expect(renderToStaticMarkup(<Screen testID="p" />)).toContain('data-testid="p-scroll"');
    expect(renderToStaticMarkup(<Screen scroll={false} testID="p" />)).not.toContain("p-scroll");
  });

  // sistema-visual FR-088 · design.md D14: el teclado no tapa el formulario. En iOS el contenido
  // se desplaza con `padding`; Android ya redimensiona la ventana (`softwareKeyboardLayoutMode`).
  test.each([
    ["ios", "padding"],
    ["android", "none"],
  ])("en %s el área desplazable va dentro de KeyboardAvoidingView (%s)", (os, behavior) => {
    const original = process.env.EXPO_OS;
    process.env.EXPO_OS = os;
    try {
      const html = renderToStaticMarkup(<Screen testID="p" />);
      const kav = html.indexOf(`data-behavior="${behavior}"`);
      expect(kav).toBeGreaterThan(-1);
      expect(html.indexOf('data-testid="p-scroll"')).toBeGreaterThan(kav);
    } finally {
      process.env.EXPO_OS = original;
    }
  });

  test("className del llamador se aplica al contenido, al final", () => {
    const html = renderToStaticMarkup(<Screen className="items-start" testID="pantalla" />);
    expect(tagWith(html, 'data-testid="pantalla"')).toMatch(/gap-6.*items-start/);
  });
});

describe("Card", () => {
  test("es una superficie con borde, radio de primer nivel y padding de la escala", () => {
    const html = renderToStaticMarkup(
      <Card className="gap-3" testID="tarjeta">
        <Text>x</Text>
      </Card>,
    );
    const card = tagWith(html, 'data-testid="tarjeta"');
    for (const c of ["rounded-xl", "border", "border-border", "bg-card", "p-4", "gap-3"]) {
      expect(card).toContain(c);
    }
  });
});
