import { describe, expect, test } from "bun:test";
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
