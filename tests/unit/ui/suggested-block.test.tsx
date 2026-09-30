import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Text } from "react-native";
import { SuggestedBlock } from "@/components/ui/suggested-block";

const tagWith = (html: string, needle: string) =>
  html.match(new RegExp(`<[^>]*${needle}[^>]*>`))?.[0] ?? "";

// FR-076 · US13-AC2 · design.md D7/D20: lo sugerido se distingue por etiqueta, pliego y contorno,
// no solo por color.
describe("SuggestedBlock", () => {
  const html = renderToStaticMarkup(
    <SuggestedBlock testID="s">
      <Text>Motivo de consulta: vocaliza de noche</Text>
    </SuggestedBlock>,
  );
  const box = tagWith(html, 'data-testid="s"');

  // D20: pliego canario con contorno de 1 px; el borde lateral grueso queda prohibido.
  test("es un pliego suggested-surface con contorno de 1 px suggested", () => {
    const cls = box.match(/data-class="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];
    expect(cls).toEqual(
      expect.arrayContaining(["bg-suggested-surface", "border", "border-suggested", "rounded-sm"]),
    );
    expect(cls.some((c) => /^border-l-/.test(c))).toBe(false);
  });

  test("es un grupo con nombre «Sugerencia del sistema»", () => {
    expect(box).toContain('role="group"');
    expect(box).toContain('aria-label="Sugerencia del sistema"');
  });

  test("la etiqueta es texto visible y va antes del contenido", () => {
    const label = html.indexOf(">Sugerencia del sistema<");
    expect(label).toBeGreaterThan(-1);
    expect(label).toBeLessThan(html.indexOf("Motivo de consulta"));
  });

  test("el icono de la etiqueta es decorativo (el texto ya la nombra)", () => {
    expect(html).toContain('aria-hidden="true"');
  });
});
