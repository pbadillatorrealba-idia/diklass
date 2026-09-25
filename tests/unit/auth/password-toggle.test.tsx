import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PasswordToggle } from "@/components/auth/password-toggle";

// sistema-visual FR-090 · US15-AC4 (design.md D16): control de visibilidad operable, con estado
// anunciado y área táctil mínima.
describe("PasswordToggle", () => {
  const render = (visible: boolean) =>
    renderToStaticMarkup(<PasswordToggle onToggle={() => {}} visible={visible} />);
  const boton = (html: string) => html.match(/^<button[^>]*>/)?.[0] ?? "";

  test("oculta: se llama «Mostrar contraseña» y no está pulsado", () => {
    const tag = boton(render(false));
    expect(tag).toContain('aria-label="Mostrar contraseña"');
    expect(tag).toContain('aria-pressed="false"');
  });

  test("visible: se llama «Ocultar contraseña» y está pulsado", () => {
    const tag = boton(render(true));
    expect(tag).toContain('aria-label="Ocultar contraseña"');
    expect(tag).toContain('aria-pressed="true"');
  });

  test("tiene el área táctil mínima y es un botón ghost", () => {
    const tag = boton(render(false));
    expect(tag).toContain("min-h-touch");
    expect(tag).toContain("min-w-touch");
    expect(tag).toContain("bg-transparent");
  });

  test("el icono es decorativo: el nombre lo da el botón", () => {
    const html = render(false);
    expect(html).toContain('aria-hidden="true"');
  });
});
