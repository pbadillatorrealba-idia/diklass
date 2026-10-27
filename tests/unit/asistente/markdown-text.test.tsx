import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownText } from "@/components/asistente/markdown-text";
import { isSafeHref } from "@/features/asistente/markdown-links";

const render = (text: string) => renderToStaticMarkup(<MarkdownText text={text} />);

// asistente-conversacional «Markdown seguro» (design.md D9).
describe("MarkdownText", () => {
  test("énfasis: negrita, cursiva y código en línea", () => {
    const html = render("Esto es **fuerte**, *suave* y `mg/kg`.");
    expect(html).toMatch(/<[^>]*font-semibold[^>]*>fuerte</);
    expect(html).toMatch(/<[^>]*italic[^>]*>suave</);
    expect(html).toMatch(/<[^>]*font-mono[^>]*>mg\/kg</);
  });

  test("encabezados con rol y nivel", () => {
    const html = render("## Resumen");
    expect(html).toContain('role="heading"');
    expect(html).toContain("Resumen");
  });

  test("listas con y sin orden", () => {
    const html = render("- uno\n- dos\n\n1. primero\n2. segundo");
    expect(html).toContain('role="list"');
    expect(html.match(/role="listitem"/g)).toHaveLength(4);
    expect(html).toContain("primero");
  });

  test("tabla con encabezados y celdas", () => {
    const html = render("| Fármaco | Dosis |\n|---|---|\n| Maropitant | 1 mg/kg |");
    expect(html).toContain('role="table"');
    expect(html.match(/role="columnheader"/g)).toHaveLength(2);
    expect(html.match(/role="cell"/g)).toHaveLength(2);
    expect(html).toContain("Maropitant");
  });

  test("bloque de código y cita", () => {
    const html = render("```\nmeloxicam 0,1 mg/kg\n```\n\n> Fuente: protocolo");
    expect(html).toContain("meloxicam 0,1 mg/kg");
    expect(html).toContain("Fuente: protocolo");
    expect(html).toContain("border-l");
  });

  test("HTML crudo se ve como texto y no se interpreta", () => {
    const html = render("Hola <script>alert(1)</script> <b>x</b>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  test("las imágenes se ven como texto y no cargan nada", () => {
    const html = render("![gráfico](https://example.org/x.png)");
    expect(html).not.toContain("<img");
    expect(html).toContain("![gráfico](https://example.org/x.png)");
  });

  test("enlace externo https: abre con destino visible", () => {
    const html = render("Ver [la guía](https://example.org/guia).");
    expect(html).toContain('href="https://example.org/guia"');
    expect(html).toContain("la guía");
    expect(html).toContain("example.org");
  });

  test("enlace interno: ruta de la app", () => {
    const html = render("Abre [la ficha](/patients/abc).");
    expect(html).toContain('href="/patients/abc"');
  });

  test.each([
    "[x](javascript:alert(1))",
    "[x](data:text/html;base64,AAAA)",
    "[x](//evil.example/x)",
    "[x](mailto:a@b.cl)",
    "[x](/\\evil.example)",
    "[x](</\t/evil.example>)",
  ])("%s no es un enlace", (fuente) => {
    const html = render(fuente);
    expect(html).not.toContain("href=");
    expect(html).toContain("x");
  });

  test("los caracteres especiales se ven tal cual, no como entidades", () => {
    const html = render("Dosis < 5 mg & > 2 mg, `a < b`");
    expect(html).toContain("Dosis &lt; 5 mg &amp; &gt; 2 mg");
    expect(html).not.toContain("&amp;amp;");
    expect(html).not.toContain("&amp;lt;");
  });

  test("texto vacío no pinta nada", () => {
    expect(render("")).toBe("");
  });
});

describe("isSafeHref", () => {
  test.each([
    ["https://example.org/a", true],
    ["http://example.org", true],
    ["/patients/1", true],
    ["javascript:alert(1)", false],
    ["JAVASCRIPT:alert(1)", false],
    ["//evil.example", false],
    ["data:text/html,x", false],
    ["ftp://example.org", false],
    // Los navegadores normalizan `\` y las tabulaciones: estos terminan siendo `//evil.example`.
    ["/\\evil.example", false],
    ["/\t/evil.example", false],
    ["/\n/evil.example", false],
    ["/ruta con espacio", false],
    ["/patients/abc?tab=1#x", true],
    ["", false],
  ])("%s → %s", (href, ok) => {
    expect(isSafeHref(href)).toBe(ok);
  });
});

// Presupuesto de design.md D9: el primer pintado de 50 mensajes con markdown, ≤ 100 ms.
describe("rendimiento", () => {
  const mensaje = (i: number) =>
    `## Resumen ${i}\n\nEl paciente presenta **vómitos** y *letargo*.\n\n| Fármaco | Dosis |\n|---|---|\n| Maropitant | 1 mg/kg |\n\n- Ayuno 12 h\n- Fluidos\n\n> Fuente: protocolo\n\n\`\`\`\nmeloxicam 0,1 mg/kg\n\`\`\`\n\nVer [guía](https://example.org/guia).`;

  test("50 mensajes se pintan dentro del presupuesto", () => {
    render(mensaje(0)); // calienta
    // El mejor de varios lotes: un runner compartido añade ruido a una sola medición, no al mínimo.
    const lotes = Array.from({ length: 5 }, () => {
      const t0 = performance.now();
      for (let i = 1; i <= 50; i++) render(mensaje(i));
      return performance.now() - t0;
    });
    expect(Math.min(...lotes)).toBeLessThan(100);
  });
});
