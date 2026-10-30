import { describe, expect, mock, test } from "bun:test";
import { MAX_SPOKEN_CHARS, spokenText } from "@/features/asistente/speaker";

describe("spokenText", () => {
  test("locuta solo el texto, no tarjetas ni avisos", () => {
    expect(
      spokenText([
        { type: "text", text: "Hola" },
        { type: "proposal", proposal: { id: "a", summary: "s", origin: "o" } },
        { type: "notice", text: "aviso" },
      ]),
    ).toBe("Hola");
  });
  test("recorta al último espacio dentro del tope", () => {
    const largo = `${"palabra ".repeat(400)}fin`;
    const r = spokenText([{ type: "text", text: largo }]);
    expect(r.length).toBeLessThanOrEqual(MAX_SPOKEN_CHARS);
    expect(r.endsWith("palabra")).toBe(true);
  });
});

describe("speak / stopSpeaking", () => {
  test("un stopSpeaking mientras llega el audio lo descarta; el siguiente sí suena", async () => {
    const creados: string[] = [];
    mock.module("@/features/asistente/audio-playback", () => ({
      createAudioPlayback: (s: { url: string }) => {
        creados.push(s.url);
        return { play() {}, pause() {}, onEnded() {}, dispose() {} };
      },
    }));
    const { speak, stopSpeaking } = await import("@/features/asistente/speaker");
    let resolver: (v: unknown) => void = () => {};
    const lento = {
      functions: {
        invoke: () =>
          new Promise((r) => {
            resolver = r;
          }),
      },
    } as never;
    const p = speak(lento, "hola");
    stopSpeaking();
    resolver({ data: { audio: "AQID", mime: "audio/mpeg" }, error: null });
    await p;
    expect(creados).toEqual([]);
    const rapido = {
      functions: {
        invoke: async () => ({ data: { audio: "AQID", mime: "audio/mpeg" }, error: null }),
      },
    } as never;
    await speak(rapido, "hola");
    expect(creados).toEqual(["data:audio/mpeg;base64,AQID"]);
    stopSpeaking();
  });
});
