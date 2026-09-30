import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AvisosCobertura } from "@/components/conocimiento/avisos-cobertura";

const tagWith = (html: string, needle: string) =>
  html.match(new RegExp(`<[^>]*${needle}[^>]*>`))?.[0] ?? "";

// FR-100 · US18-AC5 · design.md D20: el aviso de ausencia de respaldo es un renglón de la
// respuesta, con icono y texto, y permanece mientras la respuesta está visible.
describe("AvisosCobertura con sin_respaldo_documental", () => {
  const html = renderToStaticMarkup(
    <AvisosCobertura
      avisos={["sin_respaldo_documental"]}
      cobertura={{ estado: "sin_evidencia", cubiertos: [], noCubiertos: [] }}
    />,
  );
  const renglon = tagWith(html, 'data-testid="aviso-sin_respaldo_documental"');

  test("es un renglón dentro del bloque de avisos de la respuesta", () => {
    expect(html.indexOf('data-testid="avisos-cobertura"')).toBeLessThan(
      html.indexOf('data-testid="aviso-sin_respaldo_documental"'),
    );
    expect(renglon).toContain("border-y");
  });

  test("lleva icono con nombre y el texto del aviso", () => {
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Error"');
    expect(html).toContain("No dispongo de evidencia documental para esta pregunta.");
  });

  test("no es una notificación flotante ni temporal", () => {
    expect(renglon).not.toMatch(/\b(absolute|fixed)\b/);
    expect(html).not.toMatch(/aria-label="(Cerrar|Descartar)/);
    expect(renglon).not.toContain('role="status"');
  });
});
