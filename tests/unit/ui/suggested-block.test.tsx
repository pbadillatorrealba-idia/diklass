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

  // D20: la copia canaria todavía no está firmada; el nombre accesible repite la etiqueta visible.
  test("es un grupo con nombre «Sugerencia del sistema · copia sin firmar»", () => {
    expect(box).toContain('role="group"');
    expect(box).toContain('aria-label="Sugerencia del sistema · copia sin firmar"');
  });

  test("la etiqueta es texto visible y va antes del contenido", () => {
    const label = html.indexOf(">Sugerencia del sistema · copia sin firmar<");
    expect(label).toBeGreaterThan(-1);
    expect(label).toBeLessThan(html.indexOf("Motivo de consulta"));
  });

  // D20: sin el emblema de «IA» (robot, destellos); el pliego y la etiqueta ya lo dicen.
  test("no lleva icono: la etiqueta y el pliego bastan", () => {
    expect(html).not.toContain('aria-hidden="true"');
    expect(html).not.toContain("material-community");
  });
});
