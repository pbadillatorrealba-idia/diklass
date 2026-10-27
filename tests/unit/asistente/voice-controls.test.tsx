import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VoiceButton, VoicePanel } from "@/components/asistente/voice-controls";
import type { VoiceNotice, VoiceState } from "@/features/asistente/voice-message";

const PAYLOAD = { data: new ArrayBuffer(8), mimeType: "audio/webm", extension: "webm" as const };
const noop = () => {};

function api(
  state: VoiceState = { kind: "idle" },
  over: { notice?: VoiceNotice | null; blockedReason?: string | null; elapsed?: string } = {},
) {
  return {
    state,
    notice: over.notice ?? null,
    elapsed: over.elapsed ?? "00:07",
    blockedReason: over.blockedReason ?? null,
    start: noop,
    stop: noop,
    cancel: noop,
    discard: noop,
    dismissNotice: noop,
  };
}
const etiqueta = (html: string, testID: string) =>
  html.match(new RegExp(`<[^>]*data-testid="${testID}"[^>]*>`))?.[0] ?? "";
const panel = (v: ReturnType<typeof api>, onSend = noop) =>
  renderToStaticMarkup(<VoicePanel onSend={onSend} voice={v as never} />);
const boton = (v: ReturnType<typeof api>) =>
  renderToStaticMarkup(<VoiceButton voice={v as never} />);

// asistente-conversacional «Grabar, revisar y enviar audio» y «Conservación del audio por 90 días»
// (design.md D5 · tarea 7.4).
describe("VoiceButton", () => {
  test("se graba tocando, con un nombre accesible", () => {
    const html = boton(api());
    expect(html).toContain('data-testid="voice-record"');
    expect(html).toContain('aria-label="Grabar un mensaje de voz"');
    expect(etiqueta(html, "voice-record")).not.toContain("disabled");
  });

  test("con la escucha de la consulta activa queda deshabilitado", () => {
    const html = boton(
      api({ kind: "idle" }, { blockedReason: "La escucha de la consulta usa el micrófono." }),
    );
    expect(etiqueta(html, "voice-record")).toContain("disabled");
  });

  test.each([
    ["recording", { kind: "recording", startedAt: 0 } as VoiceState],
    [
      "review",
      { kind: "review", payload: PAYLOAD, durationMs: 5000, autoStopped: false } as VoiceState,
    ],
    ["sending", { kind: "sending", payload: PAYLOAD, durationMs: 5000 } as VoiceState],
  ])("mientras hay una grabación (%s) no se puede empezar otra", (_n, state) => {
    expect(etiqueta(boton(api(state)), "voice-record")).toContain("disabled");
  });
});

describe("VoicePanel · motivo del bloqueo y avisos", () => {
  test("bloqueado, explica por qué", () => {
    const html = panel(
      api({ kind: "idle" }, { blockedReason: "La escucha de la consulta usa el micrófono." }),
    );
    expect(html).toContain("La escucha de la consulta usa el micrófono.");
    expect(html).toContain('data-testid="voice-blocked"');
  });

  test("libre y en reposo no pinta nada", () => {
    expect(panel(api())).toBe("");
  });

  test.each([
    ["too-short", "demasiado corta"],
    ["unavailable", "micrófono"],
  ] as const)("el aviso «%s» se dice y ofrece escribir", (notice, texto) => {
    const html = panel(api({ kind: "idle" }, { notice }));
    expect(html).toContain(texto);
    expect(html).toContain('data-testid="voice-notice"');
    expect(html).toContain('role="status"');
  });

  test("sin permiso ofrece escribir (FR-054)", () => {
    expect(panel(api({ kind: "idle" }, { notice: "unavailable" }))).toContain("escribir");
  });

  test("«No se entendió» ofrece grabar de nuevo", () => {
    const html = panel(api({ kind: "idle" }, { notice: "not-understood" }));
    expect(html).toContain("No se entendió");
    expect(html).toContain("grabar de nuevo");
  });
});

describe("VoicePanel · grabando", () => {
  const grabando = api({ kind: "recording", startedAt: 0 }, { elapsed: "00:07" });

  test("avisa «Grabando y conservando audio» con el plazo de 90 días", () => {
    const html = panel(grabando);
    expect(html).toContain("Grabando y conservando audio");
    expect(html).toContain("90 días");
  });

  test("muestra el tiempo y los controles Cancelar y Detener", () => {
    const html = panel(grabando);
    expect(html).toContain("00:07");
    expect(html).toContain('data-testid="voice-cancel"');
    expect(html).toContain('data-testid="voice-stop"');
  });

  test("el tiempo no está en una región viva: no se anuncia cada segundo", () => {
    const html = panel(grabando);
    const inicio = html.indexOf('data-testid="voice-elapsed"');
    const antes = html.slice(Math.max(0, inicio - 400), inicio);
    expect(antes).not.toContain("aria-live");
    expect(html).toContain('data-testid="voice-status"');
  });

  test("solo el inicio de la grabación se anuncia, en una región de estado", () => {
    const html = panel(grabando);
    expect(etiqueta(html, "voice-status")).toContain('role="status"');
    expect(html).toContain("Grabando");
  });
});

describe("VoicePanel · revisión y envío", () => {
  const revision = api({
    kind: "review",
    payload: PAYLOAD,
    durationMs: 65_000,
    autoStopped: false,
  });

  test("ofrece reproducir, descartar y enviar, con la duración", () => {
    const html = panel(revision);
    expect(html).toContain('data-testid="voice-play"');
    expect(html).toContain('data-testid="voice-discard"');
    expect(html).toContain('data-testid="voice-send"');
    expect(html).toContain("01:05");
  });

  test("si la grabación se cortó sola a los 2 min, lo dice", () => {
    const html = panel(
      api({ kind: "review", payload: PAYLOAD, durationMs: 120_000, autoStopped: true }),
    );
    expect(html).toContain("2 minutos");
  });

  test("enviando: lo dice y no permite descartar ni enviar otra vez", () => {
    const html = panel(api({ kind: "sending", payload: PAYLOAD, durationMs: 5000 }));
    expect(html).toContain("Enviando audio…");
    expect(html).not.toContain('data-testid="voice-send"');
    expect(html).not.toContain('data-testid="voice-discard"');
  });
});
