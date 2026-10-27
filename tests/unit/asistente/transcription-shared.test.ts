import { describe, expect, test } from "bun:test";
import {
  calidad,
  MIME_PERMITIDOS,
  TranscriptionTimeoutError,
  tipoBase,
  transcribeWithOpenAI,
} from "../../../supabase/functions/_shared/transcription";

const audio = new Blob([new Uint8Array(100)], { type: "audio/webm;codecs=opus" });

describe("transcribeWithOpenAI", () => {
  test("envía el audio con el modelo y el idioma y devuelve el texto", async () => {
    const visto: { url?: string; init?: RequestInit } = {};
    const texto = await transcribeWithOpenAI({
      audio,
      apiKey: "clave",
      timeoutMs: 1000,
      fetcher: (async (url: string, init: RequestInit) => {
        visto.url = url;
        visto.init = init;
        return Response.json({ text: "hola doctora" });
      }) as unknown as typeof fetch,
    });
    expect(texto).toBe("hola doctora");
    expect(visto.url).toBe("https://api.openai.com/v1/audio/transcriptions");
    const form = visto.init?.body as FormData;
    expect(form.get("model")).toBe("gpt-transcribe");
    expect(form.get("language")).toBe("es");
    expect((visto.init?.headers as Record<string, string>).Authorization).toBe("Bearer clave");
  });

  test("sin credencial falla antes de llamar", async () => {
    let llamado = false;
    await expect(
      transcribeWithOpenAI({
        audio,
        apiKey: "",
        timeoutMs: 1000,
        fetcher: (async () => {
          llamado = true;
          return Response.json({});
        }) as unknown as typeof fetch,
      }),
    ).rejects.toThrow("OPENAI_API_KEY");
    expect(llamado).toBe(false);
  });

  test("un error del proveedor propaga solo el estado, no su cuerpo (que podría arrastrar la clave)", async () => {
    const error = await transcribeWithOpenAI({
      audio,
      apiKey: "clave",
      timeoutMs: 1000,
      fetcher: (async () =>
        new Response("sk-secreta en el cuerpo", { status: 429 })) as unknown as typeof fetch,
    }).catch((e: Error) => e);
    expect((error as Error).message).toBe("OPENAI_429");
    expect((error as Error).message).not.toContain("sk-secreta");
  });

  test("el tiempo máximo del proveedor se traduce en TranscriptionTimeoutError", async () => {
    await expect(
      transcribeWithOpenAI({
        audio,
        apiKey: "clave",
        timeoutMs: 1000,
        fetcher: (async () => {
          throw new DOMException("timeout", "TimeoutError");
        }) as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(TranscriptionTimeoutError);
  });

  test("sin campo text devuelve vacío", async () => {
    const texto = await transcribeWithOpenAI({
      audio,
      apiKey: "clave",
      timeoutMs: 1000,
      fetcher: (async () => Response.json({})) as unknown as typeof fetch,
    });
    expect(texto).toBe("");
  });
});

describe("compartido", () => {
  test("tipoBase quita los parámetros del tipo", () => {
    expect(tipoBase(audio)).toBe("audio/webm");
    expect(MIME_PERMITIDOS.has(tipoBase(audio))).toBe(true);
  });

  test("calidad: menos de 3 letras es insufficient", () => {
    expect(calidad("ah")).toBe("insufficient");
    expect(calidad("hola")).toBe("ok");
  });
});
