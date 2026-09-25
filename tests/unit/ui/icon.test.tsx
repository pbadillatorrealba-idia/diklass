import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Icon } from "@/components/ui/icon";

// FR-078 · design.md D8: un icono informa (nombre accesible) o decora (oculto), nunca ambos.
describe("Icon", () => {
  test("un icono con label se anuncia como imagen con ese nombre", () => {
    const html = renderToStaticMarkup(<Icon label="Aviso" name="alert-outline" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Aviso"');
    expect(html).not.toContain('aria-hidden="true"');
  });

  test("un icono decorativo queda oculto a los lectores de pantalla", () => {
    const html = renderToStaticMarkup(<Icon decorative name="alert-outline" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain("aria-label=");
  });

  test.each([
    ["sm", 16],
    ["md", 20],
    ["lg", 24],
  ] as const)("el tamaño %s mide %d px", (size, px) => {
    const html = renderToStaticMarkup(<Icon decorative name="paw" size={size} />);
    expect(html).toContain(`font-size:${px}px`);
  });

  test("los tipos exigen label o decorative", () => {
    // @ts-expect-error — sin label ni decorative no compila.
    const sinNada = <Icon name="paw" />;
    // @ts-expect-error — label y decorative a la vez no compila.
    const ambos = <Icon decorative label="Pata" name="paw" />;
    expect([sinNada, ambos]).toHaveLength(2);
  });
});
