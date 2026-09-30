import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

const classOf = (html: string) => html.match(/data-class="([^"]*)"/)?.[1]?.split(/\s+/) ?? [];

// FR-074 · design.md D5: rampa con nombre y tono secundario verificado en el tema.
describe("Text", () => {
  test.each([
    ["body", ["text-base"]],
    ["caption", ["text-sm"]],
    ["label", ["text-sm", "font-medium"]],
    ["strong", ["text-base", "font-semibold"]],
  ] as const)("la variante %s aplica %p", (variant, classes) => {
    const cls = classOf(renderToStaticMarkup(<Text variant={variant}>x</Text>));
    for (const c of classes) expect(cls).toContain(c);
    expect(cls).toContain("font-sans");
  });

  // D20: los datos (número de consulta, fechas, pesos, dosis, códigos) van en mono con cifras
  // tabulares, sin la familia de la UI.
  test("la variante data es mono con cifras tabulares", () => {
    const cls = classOf(renderToStaticMarkup(<Text variant="data">12,4 kg</Text>));
    expect(cls).toEqual(expect.arrayContaining(["font-mono", "tabular-nums", "text-base"]));
    expect(cls).not.toContain("font-sans");
  });

  // D20: rótulo preimpreso del formulario, en la tinta `primary` salvo que se pida otro tono.
  test("la variante rubric es el rótulo preimpreso en primary", () => {
    const cls = classOf(renderToStaticMarkup(<Text variant="rubric">Peso</Text>));
    expect(cls).toEqual(
      expect.arrayContaining([
        "font-sans",
        "text-sm",
        "uppercase",
        "tracking-wide",
        "font-semibold",
        "text-primary",
      ]),
    );
    expect(cls).not.toContain("text-foreground");
  });

  test("label no cambia con D20", () => {
    const cls = classOf(renderToStaticMarkup(<Text variant="label">x</Text>));
    expect(cls).toEqual(expect.arrayContaining(["text-sm", "font-medium"]));
    expect(cls).not.toContain("uppercase");
    expect(cls).not.toContain("font-mono");
  });

  test("por defecto es body con tono default", () => {
    const cls = classOf(renderToStaticMarkup(<Text>x</Text>));
    expect(cls).toContain("text-base");
    expect(cls).toContain("text-foreground");
  });

  test.each([
    ["default", "text-foreground"],
    ["muted", "text-muted-foreground"],
    ["destructive", "text-destructive"],
    ["warning", "text-warning"],
    ["success", "text-success"],
    ["info", "text-info"],
    ["onDestructive", "text-destructive-foreground"],
    ["primary", "text-primary"],
  ] as const)("el tono %s aplica %s y ningún otro color de texto", (tone, expected) => {
    const cls = classOf(renderToStaticMarkup(<Text tone={tone}>x</Text>));
    expect(cls).toContain(expected);
    const colors = cls.filter((c) =>
      /^text-(foreground|muted-foreground|destructive|destructive-foreground|warning|success|info|primary)$/.test(
        c,
      ),
    );
    expect(colors).toEqual([expected]);
  });
});

describe("Heading", () => {
  test.each([
    [1, ["text-2xl", "font-bold"]],
    [2, ["text-xl", "font-semibold"]],
    [3, ["text-lg", "font-semibold"]],
  ] as const)("el nivel %d aplica %p y expone aria-level", (level, classes) => {
    const html = renderToStaticMarkup(<Heading level={level}>x</Heading>);
    for (const c of classes) expect(classOf(html)).toContain(c);
    expect(html).toContain('role="heading"');
    expect(html).toContain(`aria-level="${level}"`);
  });

  test("por defecto es nivel 2", () => {
    const html = renderToStaticMarkup(<Heading>x</Heading>);
    expect(html).toContain('aria-level="2"');
    expect(classOf(html)).toContain("text-xl");
  });
});
