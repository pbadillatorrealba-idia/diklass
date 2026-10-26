import { describe, expect, test } from "bun:test";
import {
  parteDeAudio,
  RemoteTranscriptionAdapter,
} from "@/features/voz/remote-transcription-adapter";
import type { AudioWindow } from "@/features/voz/transcription-port";

const SESION = "59999999-0000-4000-8000-000000000001";

const ventana = (
  audio: AudioWindow["audio"] | undefined = {
    data: new Uint8Array(64).buffer,
    mimeType: "audio/webm",
    extension: "webm",
  },
): AudioWindow => ({
  listenSessionId: SESION,
  seq: 3,
  startedAt: "2026-10-26T10:00:00.000Z",
  durationMs: 30_000,
  audio,
});

type Invocacion = { name: string; options: { body: FormData; timeout?: number } };

function clienteFalso(resultado: {
  data?: unknown;
  error?: { message: string; context?: { json: () => Promise<unknown> } };
}) {
  const invocaciones: Invocacion[] = [];
  return {
    invocaciones,
    client: {
      functions: {
        invoke: async (name: string, options: Invocacion["options"]) => {
          invocaciones.push({ name, options });
          return { data: resultado.data ?? null, error: resultado.error ?? null };
        },
      },
    },
  };
}

describe("RemoteTranscriptionAdapter (D3)", () => {
  test("envía el audio y la sesión a transcribe-audio y devuelve texto y calidad", async () => {
    const f = clienteFalso({ data: { text: "Ladra todos los días", quality: "ok" } });
    const adaptador = new RemoteTranscriptionAdapter(f.client);
    const resultado = await adaptador.transcribe(ventana());
    expect(resultado).toEqual({ text: "Ladra todos los días", quality: "ok" });
    const [llamada] = f.invocaciones;
    expect(llamada?.name).toBe("transcribe-audio");
    expect(llamada?.options.body.get("listeningSessionId")).toBe(SESION);
    const archivo = llamada?.options.body.get("audio");
    expect(archivo instanceof Blob).toBe(true);
    expect((archivo as File).name).toBe("tramo-3.webm");
    expect(llamada?.options.timeout).toBe(30_000);
  });

  test("conserva la calidad insufficient (FR-031)", async () => {
    const f = clienteFalso({ data: { text: "", quality: "insufficient" } });
    const resultado = await new RemoteTranscriptionAdapter(f.client).transcribe(ventana());
    expect(resultado).toEqual({ text: "", quality: "insufficient" });
  });

  test("web: la parte es un File con nombre y tipo; nativo: una parte {uri,name,type} (RN no sube Blob)", () => {
    const web = parteDeAudio(ventana());
    expect(web instanceof File).toBe(true);
    expect((web as File).name).toBe("tramo-3.webm");
    expect((web as File).type).toBe("audio/webm");

    const nativa = parteDeAudio(
      ventana({
        data: new Uint8Array(8).buffer,
        uri: "file:///tmp/tramo.m4a",
        mimeType: "audio/mp4",
        extension: "m4a",
      }),
    );
    expect(nativa).toEqual({
      uri: "file:///tmp/tramo.m4a",
      name: "tramo-3.m4a",
      type: "audio/mp4",
    });
  });

  test("arma el multipart solo con `append` (el FormData de React Native no tiene `set`)", async () => {
    const f = clienteFalso({ data: { text: "Ladra", quality: "ok" } });
    const original = FormData.prototype.set;
    // biome-ignore lint/suspicious/noExplicitAny: se simula un FormData sin `set`.
    (FormData.prototype as any).set = () => {
      throw new TypeError("set no existe en React Native");
    };
    try {
      await new RemoteTranscriptionAdapter(f.client).transcribe(ventana());
    } finally {
      FormData.prototype.set = original;
    }
    expect(f.invocaciones).toHaveLength(1);
  });

  test("una ventana sin audio falla de forma explícita (Constitución IV)", async () => {
    const f = clienteFalso({ data: { text: "x", quality: "ok" } });
    await expect(
      new RemoteTranscriptionAdapter(f.client).transcribe({ ...ventana(), audio: undefined }),
    ).rejects.toThrow(/sin audio/i);
    expect(f.invocaciones).toHaveLength(0);
  });

  test("FR-055: un error de la función se informa con su código", async () => {
    const f = clienteFalso({
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: { json: async () => ({ code: "PROVIDER_TIMEOUT" }) },
      },
    });
    await expect(new RemoteTranscriptionAdapter(f.client).transcribe(ventana())).rejects.toThrow(
      /PROVIDER_TIMEOUT/,
    );
  });

  test("un error sin cuerpo legible conserva el mensaje del cliente", async () => {
    const f = clienteFalso({ error: { message: "Failed to fetch" } });
    await expect(new RemoteTranscriptionAdapter(f.client).transcribe(ventana())).rejects.toThrow(
      /Failed to fetch/,
    );
  });

  test("una respuesta inválida se rechaza en lugar de inventar texto", async () => {
    const f = clienteFalso({ data: { quality: "ok" } });
    await expect(new RemoteTranscriptionAdapter(f.client).transcribe(ventana())).rejects.toThrow();
  });
});
