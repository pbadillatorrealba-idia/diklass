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

  test("conserva la proporción del wordmark", () => {
    expect(renderToStaticMarkup(<Logo />)).toContain("aspect-ratio:5.435");
  });
});
