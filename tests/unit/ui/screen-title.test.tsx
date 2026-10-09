import { afterEach, describe, expect, spyOn, test } from "bun:test";
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

// Breadcrumb de escritorio: desde `lg`, en web, sustituye a «Volver a …».
describe("Screen breadcrumb", () => {
  test("en web ancho pinta la ruta con el padre enlazado y la página actual", async () => {
    process.env.EXPO_OS = "web";
    const rn = await import("react-native");
    const spy = spyOn(rn, "useWindowDimensions").mockReturnValue({
      width: 1280,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
    try {
      const html = renderToStaticMarkup(
        <Screen
          back={{
            href: "/knowledge/sources",
            label: "la colección",
            crumbs: [
              { href: "/knowledge", label: "Conocimiento" },
              { href: "/knowledge/sources", label: "Colección" },
            ],
          }}
          title="Fuente"
        />,
      );
      expect(html).not.toContain("Volver a");
      expect(html).toContain('aria-label="Ruta"');
      expect(html).toMatch(/<a href="\/knowledge"[^>]*>.*Conocimiento/);
      expect(html).toMatch(/<a href="\/knowledge\/sources"[^>]*data-testid="screen-back"/);
      expect(html).toMatch(/aria-current="page"[^>]*>Fuente</);
    } finally {
      spy.mockRestore();
    }
  });
});

// La acción principal va en la línea del título en web ancho y en una barra al pie si no.
describe("Screen action", () => {
  const render = async (os: string, width: number) => {
    process.env.EXPO_OS = os;
    const rn = await import("react-native");
    const spy = spyOn(rn, "useWindowDimensions").mockReturnValue({
      width,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
    try {
      return renderToStaticMarkup(
        <Screen action={<button type="button">Abrir</button>} title="Luna" />,
      );
    } finally {
      spy.mockRestore();
    }
  };

  test("en web ancho no hay barra al pie", async () => {
    expect(await render("web", 1280)).not.toContain("screen-action-bar");
  });

  test("en web estrecho y en nativo la acción va en la barra al pie", async () => {
    expect(await render("web", 375)).toContain("screen-action-bar");
    expect(await render("ios", 1280)).toContain("screen-action-bar");
  });
});
