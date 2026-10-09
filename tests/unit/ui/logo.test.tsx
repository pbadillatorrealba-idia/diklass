import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Logo } from "@/components/ui/logo";

// FR-102 · design.md D5: el wordmark es una imagen con el nombre accesible «Diklass».
describe("Logo", () => {
  test("se anuncia como imagen llamada Diklass", () => {
    const html = renderToStaticMarkup(<Logo />);
    expect(html).toContain('aria-label="Diklass"');
    expect(html).toContain('role="img"');
  });

  test.each([
    ["sm", 20],
    ["md", 28],
    ["lg", 44],
  ] as const)("el tamaño %s mide %d px de alto", (size, px) => {
    expect(renderToStaticMarkup(<Logo size={size} />)).toContain(`height:${px}px`);
  });

  // Sin ancho explícito el <img> oculto de RN Web hereda el ancho natural del PNG y desborda a 320 px.
  test("fija el ancho según la proporción del wordmark", () => {
    expect(renderToStaticMarkup(<Logo size="sm" />)).toContain("width:109px");
  });
});
