import { afterEach, describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// Los dobles de `expo-router` viven en `tests/unit/setup/react-native.ts`.
const stackOptions =
  (globalThis as { __stackScreenOptions?: unknown[] }).__stackScreenOptions ?? [];

import { Screen } from "@/components/ui/screen";

const ORIGINAL_OS = process.env.EXPO_OS;

afterEach(() => {
  process.env.EXPO_OS = ORIGINAL_OS;
  stackOptions.length = 0;
});

// sistema-visual FR-083 · design.md D12: título y retroceso de cada pantalla.
describe("Screen title/back", () => {
  test("en web pinta el h1 y el <title> del documento", () => {
    process.env.EXPO_OS = "web";
    const html = renderToStaticMarkup(<Screen title="Pacientes" />);
    expect(html).toContain("<title>Pacientes · Diklass</title>");
    expect(html).toMatch(/aria-level="1"[^>]*>Pacientes</);
    expect(stackOptions).toEqual([]);
  });

  test("en web, back pinta un enlace «Volver a …» antes del título", () => {
    process.env.EXPO_OS = "web";
    const html = renderToStaticMarkup(
      <Screen back={{ href: "/follow-up", label: "Seguimiento" }} title="Luna" />,
    );
    expect(html).toMatch(/<a href="\/follow-up"[^>]*>.*Volver a Seguimiento/);
    expect(html.indexOf("Volver a Seguimiento")).toBeLessThan(html.indexOf('aria-level="1"'));
  });

  test("en nativo el título va a la cabecera del Stack y no se duplica como h1", () => {
    process.env.EXPO_OS = "ios";
    const html = renderToStaticMarkup(
      <Screen back={{ href: "/follow-up", label: "Seguimiento" }} title="Luna" />,
    );
    expect(stackOptions).toEqual([{ title: "Luna" }]);
    expect(html).not.toContain('aria-level="1"');
    expect(html).not.toContain("Volver a");
  });
});
