import { describe, expect, test } from "bun:test";
import {
  createNativeWindowRecorder,
  type NativeAudio,
} from "@/features/voz/create-window-recorder";

function audioFalso(opciones: { permiso?: boolean; falla?: "prepare" } = {}) {
  const eventos: string[] = [];
  const audio: NativeAudio = {
    requestPermission: async () => opciones.permiso ?? true,
    setRecordingMode: async (activo) => {
      eventos.push(`modo:${activo}`);
    },
    createRecorder: () => ({
      prepare: async () => {
        if (opciones.falla === "prepare") throw new Error("sin micrófono");
        eventos.push("prepare");
      },
      record: () => {
        eventos.push("record");
      },
      stop: async () => {
        eventos.push("stop");
        return "file:///tmp/tramo.m4a";
      },
      release: () => {
        eventos.push("liberar");
      },
    }),
    readFile: async (uri) => {
      eventos.push(`leer:${uri}`);
      return new Uint8Array(32).buffer;
    },
  };
  return { audio, eventos };
}

describe("createNativeWindowRecorder (D2)", () => {
  test("FR-054: el permiso denegado deja la fuente no disponible", async () => {
    const { audio } = audioFalso({ permiso: false });
    expect(await createNativeWindowRecorder(audio).available()).toBe(false);
    expect(await createNativeWindowRecorder(audioFalso().audio).available()).toBe(true);
  });

  test("una ventana es un archivo M4A autocontenido con su tipo", async () => {
    const { audio, eventos } = audioFalso();
    const grabador = createNativeWindowRecorder(audio);
    await grabador.available();
    await grabador.start();
    const archivo = await grabador.stop();
    expect(archivo.mimeType).toBe("audio/mp4");
    expect(archivo.extension).toBe("m4a");
    // `uri` viaja con el archivo: React Native sube partes {uri,name,type}, no Blob (hallazgo de la PR #66).
    expect(archivo.uri).toBe("file:///tmp/tramo.m4a");
    expect(archivo.data.byteLength).toBe(32);
    expect(eventos).toEqual([
      "modo:true",
      "prepare",
      "record",
      "stop",
      "leer:file:///tmp/tramo.m4a",
      // Cada ventana crea un grabador nativo: se libera al terminar (hallazgo de la PR #66).
      "liberar",
    ]);
  });

  test("falla explícita si el micrófono no se puede preparar", async () => {
    const { audio } = audioFalso({ falla: "prepare" });
    const grabador = createNativeWindowRecorder(audio);
    await grabador.available();
    await expect(grabador.start()).rejects.toThrow(/sin micrófono/);
  });

  test("release desactiva el modo de grabación y es idempotente", async () => {
    const { audio, eventos } = audioFalso();
    const grabador = createNativeWindowRecorder(audio);
    await grabador.available();
    await grabador.start();
    grabador.release();
    grabador.release();
    await Promise.resolve();
    expect(eventos.filter((e) => e === "modo:false")).toHaveLength(1);
  });
});
