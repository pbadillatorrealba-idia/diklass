import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Text } from "react-native";
import { SuggestedBlock } from "@/components/ui/suggested-block";

const tagWith = (html: string, needle: string) =>
  html.match(new RegExp(`<[^>]*${needle}[^>]*>`))?.[0] ?? "";

// FR-076 · US13-AC2 · design.md D7: lo sugerido se distingue por etiqueta y borde, no solo por color.
describe("SuggestedBlock", () => {
  const html = renderToStaticMarkup(
    <SuggestedBlock testID="s">
      <Text>Motivo de consulta: vocaliza de noche</Text>
    </SuggestedBlock>,
  );
  const box = tagWith(html, 'data-testid="s"');

  test("lleva el borde lateral del token suggested", () => {
    expect(box).toContain("border-l-4");
    expect(box).toContain("border-suggested");
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
