import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsultationHeader } from "@/components/registro/consultation-header";
import { FormSection } from "@/components/ui/form-section";
import { Text } from "@/components/ui/text";

const tagWith = (html: string, needle: string) =>
  html.match(new RegExp(`<[^>]*${needle}[^>]*>`))?.[0] ?? "";

// design.md D20: sección numerada con la banda preimpresa y el cuerpo con reglas de 1 px.
describe("FormSection", () => {
  const render = (active?: boolean) =>
    renderToStaticMarkup(
      <FormSection active={active} number={2} testID="s" title="Diagnóstico">
        <Text>Cuerpo</Text>
      </FormSection>,
    );

  test("el título de sección lleva su número y es un h2", () => {
    const html = render();
    const heading = tagWith(html, 'role="heading"');
    expect(heading).toContain('aria-level="2"');
    expect(html.replace(/<!-- -->/g, "")).toMatch(
      /aria-level="2"[^>]*>(<[^>]+>)*2(<[^>]+>)*\s+Diagnóstico</,
    );
  });

  test("la banda es preimpresa en primary-surface y el cuerpo va sobre la hoja con regla de 1 px", () => {
    const html = render();
    expect(tagWith(html, 'data-testid="s-band"')).toContain("bg-primary-surface");
    const box = tagWith(html, 'data-testid="s"');
    for (const c of ["border", "border-border", "bg-card", "rounded-sm"]) expect(box).toContain(c);
    expect(html.indexOf("Diagnóstico")).toBeLessThan(html.indexOf("Cuerpo"));
  });

  test("la sección activa se marca con la banda en primary sólido, no con un borde lateral", () => {
    const band = tagWith(render(true), 'data-testid="s-band"');
    expect(band).toContain("bg-primary");
    expect(band).not.toContain("bg-primary-surface");
    expect(render(true)).toContain("text-primary-foreground");
    expect(render(true)).not.toMatch(/border-l-/);
  });
});

// US18-AC2 · design.md D20: paciente, tutor, número de consulta, fecha en mono y la clave.
describe("ConsultationHeader", () => {
  const html = renderToStaticMarkup(
    <ConsultationHeader
      createdAt="2026-09-30T13:05:00Z"
      ordinal={3}
      patientName="Kira"
      status="open"
      tutorName="Sra. Tania Rojas"
    />,
  ).replace(/<!-- -->/g, "");

  // Aclaración de D20: el estado es un campo rotulado del encabezado.
  test("el estado de la consulta es un campo rotulado", () => {
    expect(html).toMatch(/uppercase[^>]*>Estado</);
    expect(html).toContain(">Abierta<");
  });

  test("muestra paciente, tutor y «Consulta n.º N»", () => {
    expect(html).toContain(">Kira<");
    expect(html).toContain(">Sra. Tania Rojas<");
    expect(html).toMatch(/Consulta n\.º (<[^>]+>)*3</);
  });

  test("la fecha y el número van en la mono de datos", () => {
    expect(html).toMatch(/font-mono[^>]*>3</);
    expect(html).toMatch(/font-mono[^>]*>\d{2}-\d{2}-2026</);
  });

  test("incluye la clave de procedencia", () => {
    expect(html).toContain('aria-label="Clave de procedencia"');
  });

  test("sin tutor ni ordinal legibles no inventa datos", () => {
    const vacio = renderToStaticMarkup(
      <ConsultationHeader
        createdAt="2026-09-30T13:05:00Z"
        ordinal={null}
        patientName="Kira"
        status="closed"
        tutorName={null}
      />,
    );
    expect(vacio).toContain("Tutor no disponible");
    expect(vacio).not.toContain("n.º");
  });
});
