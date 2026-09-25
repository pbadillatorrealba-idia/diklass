import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Callout } from "@/components/ui/callout";
import { Text } from "@/components/ui/text";

const tagWith = (html: string, needle: string) =>
  html.match(new RegExp(`<[^>]*${needle}[^>]*>`))?.[0] ?? "";

// FR-075 · design.md D7: estado con superficie, borde e icono con nombre (nunca solo color).
describe("Callout", () => {
  test.each([
    ["error", "bg-destructive-surface", "border-destructive", "Error"],
    ["warning", "bg-warning-surface", "border-warning", "Aviso"],
    ["success", "bg-success-surface", "border-success", "Correcto"],
    ["info", "bg-info-surface", "border-info", "Información"],
  ] as const)("el tono %s usa %s, %s y un icono llamado «%s»", (tone, surface, border, name) => {
    const html = renderToStaticMarkup(
      <Callout testID="c" tone={tone}>
        Texto del aviso
      </Callout>,
    );
    const box = tagWith(html, 'data-testid="c"');
    expect(box).toContain(surface);
    expect(box).toContain(border);
    expect(html).toContain(`aria-label="${name}"`);
    expect(html).toContain('role="img"');
    expect(html).toContain("Texto del aviso");
  });

  test.each([
    ["error", true],
    ["warning", true],
    ["success", false],
    ["info", false],
  ] as const)("el tono %s se anuncia al aparecer: %p", (tone, live) => {
    const box = tagWith(
      renderToStaticMarkup(<Callout testID="c" tone={tone} />),
      'data-testid="c"',
    );
    expect(box.includes('aria-live="polite"')).toBe(live);
  });

  test("el título opcional va en texto fuerte antes del contenido", () => {
    const html = renderToStaticMarkup(
      <Callout title="Cobertura parcial" tone="warning">
        Detalle
      </Callout>,
    );
    expect(html.indexOf("Cobertura parcial")).toBeLessThan(html.indexOf("Detalle"));
    expect(html).toMatch(/font-semibold[^>]*>Cobertura parcial/);
  });

  // Regresión: con interpolación, el contenido es un arreglo de textos, no un solo string; sin
  // envolverlo, RN rechaza nodos de texto sueltos dentro de un View.
  test("un contenido con varios textos interpolados se envuelve en Text", () => {
    const faltante = "dosis";
    const html = renderToStaticMarkup(
      <Callout testID="c" tone="warning">
        Queda sin cubrir: «{faltante}».
      </Callout>,
    );
    expect(html).toMatch(
      /<div dir="auto"[^>]*>Queda sin cubrir: «(<!-- -->)?dosis(<!-- -->)?»\.<\/div>/,
    );
  });

  // sistema-visual FR-087 · design.md D14: el mensaje de error se puede copiar para reportarlo.
  describe("texto seleccionable", () => {
    // Clases del nodo de texto que contiene `texto` (el icono también es un nodo de texto).
    const clasesDe = (html: string, texto = "x") =>
      html
        .match(new RegExp(`<div dir="auto"[^>]*class="([^"]*)"[^>]*>${texto}<`))?.[1]
        ?.split(/\s+/) ?? [];
    const seleccionable = clasesDe(renderToStaticMarkup(<Text selectable>x</Text>)).filter((c) =>
      c.startsWith("r-userSelect"),
    );

    test("el texto de un Callout de error es seleccionable", () => {
      const html = renderToStaticMarkup(<Callout tone="error">No pudimos guardar</Callout>);
      expect(seleccionable.length).toBe(1);
      expect(clasesDe(html, "No pudimos guardar")).toEqual(expect.arrayContaining(seleccionable));
    });

    test("el texto de un Callout informativo no se marca seleccionable", () => {
      const html = renderToStaticMarkup(<Callout tone="info">Guardado</Callout>);
      const clases = clasesDe(html, "Guardado");
      expect(clases.length).toBeGreaterThan(0);
      expect(clases.some((c) => c.startsWith("r-userSelect"))).toBe(false);
    });
  });
});
