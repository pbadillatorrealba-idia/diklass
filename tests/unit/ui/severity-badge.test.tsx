import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { AdverseEventSeverity } from "@/features/retroalimentacion/schema";

const tagWith = (html: string, needle: string) =>
  html.match(new RegExp(`<[^>]*${needle}[^>]*>`))?.[0] ?? "";

// FR-077 · US13-AC3 · design.md D4: nombre visible, icono y color; grave y crítico destacan.
describe("SeverityBadge", () => {
  test.each([
    ["leve", "Leve", "bg-info-surface", "information-outline", false],
    ["moderado", "Moderado", "bg-warning-surface", "alert-outline", false],
    ["grave", "Grave", "bg-destructive-surface", "alert", true],
    ["critico", "Crítico", "bg-destructive", "alert-octagon", true],
  ] as const)("%s muestra «%s» con %s", (level, name, surface, _icon, strong) => {
    const html = renderToStaticMarkup(<SeverityBadge level={level} testID="b" />);
    const badge = tagWith(html, 'data-testid="b"');
    expect(badge.split('data-class="')[1]?.split('"')[0]?.split(" ")).toContain(surface);
    expect(html).toContain(`>${name}<`);
    expect(html).toContain('aria-hidden="true"');
    expect(/font-semibold[^>]*>[^<]*</.test(html)).toBe(strong);
  });

  // FR-077 · US13-AC3 · D20: barra de 4 segmentos, tantos llenos como la posición en la escala.
  // Lleno es sólido y vacío solo contorno: se distinguen también en escala de grises.
  test.each([
    ["leve", 1],
    ["moderado", 2],
    ["grave", 3],
    ["critico", 4],
  ] as const)("%s llena %d de 4 segmentos", (level, filled) => {
    const html = renderToStaticMarkup(<SeverityBadge level={level} />);
    expect(html.match(/data-testid="severity-segment-filled"/g)?.length ?? 0).toBe(filled);
    expect(html.match(/data-testid="severity-segment-empty"/g)?.length ?? 0).toBe(4 - filled);
  });

  test("la barra es decorativa y el nombre del nivel sigue siendo el texto accesible", () => {
    const html = renderToStaticMarkup(<SeverityBadge level="grave" />);
    const bar = tagWith(html, 'data-testid="severity-bar"');
    expect(bar).toContain('aria-hidden="true"');
    const visibleText = html
      // Quita el icono (un glifo) y la barra (segmentos vacíos), ambos ocultos.
      .replace(/<div[^>]*aria-hidden="true"[^>]*>(?:[^<]*|(?:<div[^>]*><\/div>)*)<\/div>/g, "")
      .replace(/<[^>]+>/g, "");
    expect(visibleText.trim()).toBe("Grave");
  });

  test("crítico es un relleno sólido con texto sobre destructive", () => {
    const html = renderToStaticMarkup(<SeverityBadge level="critico" />);
    expect(html).toContain("text-destructive-foreground");
    expect(html).not.toContain("bg-destructive-surface");
  });

  test("acepta todo el vocabulario de eventos adversos sin cambiarlo", () => {
    expect([...AdverseEventSeverity]).toEqual(["leve", "moderado", "grave"]);
    for (const level of AdverseEventSeverity) {
      expect(renderToStaticMarkup(<SeverityBadge level={level} />)).toContain("rounded-sm");
    }
  });
});
