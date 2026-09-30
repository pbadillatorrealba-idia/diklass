import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Field } from "@/components/ui/field";
import { ProvenanceKey, ProvenanceMark } from "@/components/ui/provenance-mark";
import { Text } from "@/components/ui/text";

const tagWith = (html: string, needle: string) =>
  html.match(new RegExp(`<[^>]*${needle}[^>]*>`))?.[0] ?? "";

// FR-097 · US18-AC1 · design.md D20: la procedencia al margen, con código, nombre y forma propia.
describe("ProvenanceMark", () => {
  test.each([
    ["reportada", "R", "Reportada"],
    ["inferida", "I", "Inferida"],
    ["recuperada", "F", "Recuperada"],
    ["desconocida", "?", "Desconocida"],
  ] as const)("%s muestra «%s» y se anuncia «Procedencia: %s»", (provenance, code, label) => {
    const html = renderToStaticMarkup(<ProvenanceMark provenance={provenance} testID="m" />);
    const box = tagWith(html, 'data-testid="m"');
    expect(box).toContain('role="img"');
    expect(box).toContain(`aria-label="Procedencia: ${label}"`);
    expect(html).toContain(`>${code}<`);
  });

  test("el código va en un recuadro de 1 px y en la mono de datos", () => {
    const html = renderToStaticMarkup(<ProvenanceMark provenance="inferida" testID="m" />);
    const box = tagWith(html, 'data-testid="m"');
    for (const c of ["border", "border-primary", "rounded-sm"]) expect(box).toContain(c);
    expect(html).toContain("font-mono");
  });

  // Revisión de la PR #41: con el texto al máximo (FR-074), una caja fija recortaba el código.
  test("el recuadro crece con el texto: tamaño mínimo y no fijo", () => {
    const html = renderToStaticMarkup(<ProvenanceMark provenance="inferida" testID="m" />);
    const clases =
      tagWith(html, 'data-testid="m"')
        .match(/data-class="([^"]*)"/)?.[1]
        ?.split(/\s+/) ?? [];
    expect(clases).toEqual(expect.arrayContaining(["min-h-6", "min-w-6"]));
    expect(clases).not.toContain("h-6");
    expect(clases).not.toContain("w-6");
  });

  test("«desconocida» tiene además un recuadro discontinuo, no solo otra letra", () => {
    const unknown = renderToStaticMarkup(<ProvenanceMark provenance="desconocida" testID="m" />);
    const reported = renderToStaticMarkup(<ProvenanceMark provenance="reportada" testID="m" />);
    expect(tagWith(unknown, 'data-testid="m"')).toContain("border-dashed");
    expect(tagWith(reported, 'data-testid="m"')).not.toContain("border-dashed");
  });
});

describe("ProvenanceKey", () => {
  const html = renderToStaticMarkup(<ProvenanceKey testID="clave" />);

  test("es una lista con nombre «Clave de procedencia»", () => {
    const key = tagWith(html, 'data-testid="clave"');
    expect(key).toContain('role="list"');
    expect(key).toContain('aria-label="Clave de procedencia"');
    expect(html.match(/role="listitem"/g)?.length).toBe(4);
  });

  test("muestra los cuatro códigos con su nombre visible, en el orden del vocabulario", () => {
    const order = ["R", "Reportada", "I", "Inferida", "F", "Recuperada", "?", "Desconocida"].map(
      (text) => html.indexOf(`>${text}<`),
    );
    for (const index of order) expect(index).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  test("el nombre visible basta: los códigos de la clave no repiten «Procedencia:»", () => {
    expect(html).not.toContain("Procedencia:");
  });
});

describe("Field", () => {
  test("rótulo preimpreso y valor, con la procedencia al margen", () => {
    const html = renderToStaticMarkup(
      <Field label="Motivo de consulta" provenance="inferida" testID="campo">
        Vocaliza de noche
      </Field>,
    );
    expect(html).toContain(">Motivo de consulta<");
    expect(html).toContain("uppercase");
    expect(html).toContain(">Vocaliza de noche<");
    expect(html).toContain('aria-label="Procedencia: Inferida"');
    expect(html.indexOf("Vocaliza de noche")).toBeLessThan(html.indexOf("Procedencia: Inferida"));
    expect(tagWith(html, 'data-testid="campo"')).toContain("border-b");
  });

  // Revisión de la PR #41: con varias correcciones, el margen crecía sin tope y apretaba el valor.
  test("el margen tiene un ancho máximo y el valor conserva su columna", () => {
    const html = renderToStaticMarkup(
      <Field label="Motivo" mark={<Text>R · I · F · ? · R</Text>} testID="campo">
        Vocaliza
      </Field>,
    );
    const margen = tagWith(html, 'data-testid="campo-margin"');
    expect(margen).toContain("max-w-[40%]");
  });

  test("sin procedencia no pinta ninguna marca", () => {
    const html = renderToStaticMarkup(<Field label="Peso">12,4 kg</Field>);
    expect(html).toContain(">12,4 kg<");
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain("Procedencia");
  });

  // D14: los datos clínicos se pueden copiar; el rótulo no.
  test("un valor de texto es copiable y el rótulo no", () => {
    const clasesDe = (html: string, texto: string) =>
      html
        .match(new RegExp(`<div dir="auto"[^>]*class="([^"]*)"[^>]*>${texto}<`))?.[1]
        ?.split(/\s+/) ?? [];
    const seleccionable = clasesDe(renderToStaticMarkup(<Text selectable>x</Text>), "x").filter(
      (c) => c.startsWith("r-userSelect"),
    );
    const html = renderToStaticMarkup(<Field label="Peso">12,4 kg</Field>);
    expect(seleccionable.length).toBe(1);
    expect(clasesDe(html, "12,4 kg")).toEqual(expect.arrayContaining(seleccionable));
    expect(clasesDe(html, "Peso").some((c) => c.startsWith("r-userSelect"))).toBe(false);
  });
});
