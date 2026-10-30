import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Composer } from "@/components/asistente/composer";
import { MAX_LINES, sendOnKey } from "@/features/asistente/composer-keys";

const noop = () => {};
const render = (over: Partial<Parameters<typeof Composer>[0]> = {}) =>
  renderToStaticMarkup(
    <Composer isResponding={false} onChangeText={noop} onSend={noop} value="" {...over} />,
  );
const etiqueta = (html: string, testID: string) =>
  html.match(new RegExp(`<[^>]*data-testid="${testID}"[^>]*>`))?.[0] ?? "";

// asistente-conversacional «Composer del chat» (design.md D10).
describe("sendOnKey (web)", () => {
  test.each([
    [{ key: "Enter" }, true],
    [{ key: "Enter", shiftKey: true }, false],
    [{ key: "Enter", isComposing: true }, false],
    [{ key: "Enter", keyCode: 229 }, false],
    [{ key: "a" }, false],
    [{ key: "Tab" }, false],
  ])("%o → %s", (evento, envia) => {
    expect(sendOnKey(evento)).toBe(envia);
  });

  test("el campo crece hasta 6 líneas", () => {
    expect(MAX_LINES).toBe(6);
  });
});

describe("Composer", () => {
  test("campo multilínea con nombre accesible", () => {
    const html = render();
    expect(html).toContain("<textarea");
    expect(html).toContain('aria-label="Mensaje al asistente"');
  });

  test("el envío está deshabilitado con el campo vacío o en blanco", () => {
    expect(etiqueta(render({ value: "" }), "composer-send")).toContain("disabled");
    expect(etiqueta(render({ value: "   \n " }), "composer-send")).toContain("disabled");
  });

  test("con texto el envío está habilitado", () => {
    expect(etiqueta(render({ value: "hola" }), "composer-send")).not.toContain("disabled");
  });

  test("mientras el asistente responde ofrece «Detener» en lugar de «Enviar»", () => {
    const html = render({ isResponding: true, onStop: noop, value: "otra" });
    expect(html).toContain('data-testid="composer-stop"');
    expect(html).toContain("Detener");
    expect(html).not.toContain('data-testid="composer-send"');
  });

  test("sin respuesta en curso no hay «Detener»", () => {
    expect(render()).not.toContain("composer-stop");
  });

  test("admite una acción extra junto al envío (el micrófono de 7.4)", () => {
    expect(render({ actions: <span data-testid="extra" /> })).toContain('data-testid="extra"');
  });
});
