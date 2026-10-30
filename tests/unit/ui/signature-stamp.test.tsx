import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SignatureStamp } from "@/components/ui/signature-stamp";

const tagWith = (html: string, needle: string) =>
  html.match(new RegExp(`<[^>]*${needle}[^>]*>`))?.[0] ?? "";

// FR-076 · FR-099 · design.md D20: lo aprobado se firma con un timbre de nombre y momento.
describe("SignatureStamp", () => {
  const html = renderToStaticMarkup(
    <SignatureStamp actor="Dra. Ana Pérez" occurredAt="30-09-2026, 10:42:00" testID="timbre" />,
  );
  const stamp = tagWith(html, 'data-testid="timbre"');

  test("muestra el nombre y el momento como texto visible", () => {
    expect(html).toContain(">Dra. Ana Pérez<");
    expect(html).toContain(">30-09-2026, 10:42:00<");
  });

  test("es un marco de tampón de 1 px en la tinta stamp, sin pliego", () => {
    for (const c of ["border", "border-stamp", "rounded-sm"]) expect(stamp).toContain(c);
    expect(html).toContain("text-stamp");
    expect(html).not.toContain("suggested");
  });

  test("el momento va en la mono de datos", () => {
    expect(html).toMatch(/class="[^"]*font-mono[^"]*"[^>]*>30-09-2026, 10:42:00</);
  });

  test("se anuncia como firma con autor y momento", () => {
    expect(stamp).toContain('role="group"');
    expect(stamp).toContain('aria-label="Firmado por Dra. Ana Pérez el 30-09-2026, 10:42:00"');
  });
});
