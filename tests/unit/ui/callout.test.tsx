import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Callout } from "@/components/ui/callout";

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
});
