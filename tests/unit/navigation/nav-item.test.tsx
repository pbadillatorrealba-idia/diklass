import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NavItem } from "@/components/navigation/nav-item";
import { SECTIONS } from "@/components/navigation/sections";
import { SkipLink } from "@/components/navigation/skip-link";

// sistema-visual FR-082 · design.md D12: cada sección es un enlace con icono y nombre, y la actual
// se marca con `aria-current` y con algo más que el color (peso y barra indicadora).
describe("NavItem", () => {
  const render = (isFocused: boolean, variant: "sidebar" | "tabbar" = "sidebar") =>
    renderToStaticMarkup(
      <NavItem
        href="/patients"
        icon="paw"
        isFocused={isFocused}
        label="Pacientes"
        testID="nav-patients"
        variant={variant}
      />,
    );

  test("es un enlace real con href y nombre visible", () => {
    const html = render(false);
    expect(html).toMatch(/^<a [^>]*href="\/patients"/);
    expect(html).toContain(">Pacientes<");
    expect(html).toContain('aria-hidden="true"');
  });

  test("la sección actual lleva aria-current, peso semibold, barra bg-primary y fondo bg-muted", () => {
    const html = render(true);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("font-semibold");
    expect(html).toContain('data-testid="nav-patients-indicator"');
    expect(html).toMatch(/data-class="[^"]*bg-primary[^"]*"/);
    expect(html).toMatch(/data-class="[^"]*bg-muted[^"]*"/);
  });

  test("una sección no actual no lleva aria-current ni indicador", () => {
    const html = render(false);
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("nav-patients-indicator");
  });

  test.each(["sidebar", "tabbar"] as const)("en %s el área táctil es min-h-touch", (variant) => {
    expect(render(false, variant)).toMatch(/data-class="[^"]*min-h-touch[^"]*"/);
  });
});

describe("secciones", () => {
  test("son las cuatro de D12, con icono web y SF/Material para nativo", () => {
    expect(SECTIONS.map((s) => [s.label, s.href])).toEqual([
      ["Inicio", "/home"],
      ["Pacientes", "/patients"],
      ["Seguimiento", "/follow-up"],
      ["Conocimiento", "/knowledge"],
    ]);
    for (const section of SECTIONS) {
      expect(section.icon && section.sf && section.md).toBeTruthy();
    }
  });
});

describe("SkipLink", () => {
  test("es un enlace «Saltar al contenido» hacia #contenido", () => {
    const html = renderToStaticMarkup(<SkipLink targetId="contenido" />);
    expect(html).toMatch(/^<a [^>]*href="#contenido"/);
    expect(html).toContain("Saltar al contenido");
  });
});
