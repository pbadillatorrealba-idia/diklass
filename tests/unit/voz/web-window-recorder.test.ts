import { describe, expect, test } from "bun:test";
import {
  createWebWindowRecorder,
  type WebMediaEnv,
} from "@/features/voz/create-window-recorder.web";

class FakeRecorder {
  static soportados = ["audio/webm;codecs=opus", "audio/webm"];
  static creados: FakeRecorder[] = [];
  static isTypeSupported = (tipo: string) => FakeRecorder.soportados.includes(tipo);

  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((evento: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(
    readonly stream: unknown,
    readonly opciones: { mimeType: string },
  ) {
    FakeRecorder.creados.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({
        data: new Blob([new Uint8Array(16)], { type: this.opciones.mimeType }),
      });
      this.onstop?.();
    });
  }
}

function entorno(opciones: { permiso?: boolean; sinApi?: boolean } = {}) {
  const pistas = { detenidas: 0 };
  FakeRecorder.creados = [];
  FakeRecorder.soportados = ["audio/webm;codecs=opus", "audio/webm"];
  const env: WebMediaEnv = {
    getUserMedia: async () => {
      if (opciones.permiso === false) throw new DOMException("denegado", "NotAllowedError");
      return {
        getTracks: () => [{ stop: () => (pistas.detenidas += 1) }],
      } as unknown as MediaStream;
    },
    MediaRecorder: FakeRecorder as unknown as WebMediaEnv["MediaRecorder"],
  };
  return { env: opciones.sinApi ? null : env, pistas };
}

describe("createWebWindowRecorder (D2)", () => {
  test("FR-054: sin permiso, sin API o sin formato soportado no está disponible", async () => {
    expect(await createWebWindowRecorder(entorno({ permiso: false }).env).available()).toBe(false);
    expect(await createWebWindowRecorder(entorno({ sinApi: true }).env).available()).toBe(false);
    const sinFormato = entorno();
    FakeRecorder.soportados = [];
    expect(await createWebWindowRecorder(sinFormato.env).available()).toBe(false);
  });

  test("cada ventana es un archivo autocontenido en WebM/Opus", async () => {
    const { env } = entorno();
    const grabador = createWebWindowRecorder(env);
    expect(await grabador.available()).toBe(true);
    await grabador.start();
    const primero = await grabador.stop();
    await grabador.start();
    const segundo = await grabador.stop();
    expect(primero.mimeType).toBe("audio/webm");
    expect(primero.extension).toBe("webm");
    expect(primero.blob.size).toBe(16);
    expect(segundo.blob.size).toBe(16);
    // Un MediaRecorder nuevo por ventana, sobre el mismo flujo del micrófono.
    expect(FakeRecorder.creados).toHaveLength(2);
    expect(FakeRecorder.creados[0]?.stream).toBe(FakeRecorder.creados[1]?.stream);
  });

  test("elige audio/mp4 (m4a) cuando el navegador solo graba MP4", async () => {
    const { env } = entorno();
    FakeRecorder.soportados = ["audio/mp4"];
    const grabador = createWebWindowRecorder(env);
    await grabador.available();
    await grabador.start();
    const archivo = await grabador.stop();
    expect(archivo.mimeType).toBe("audio/mp4");
    expect(archivo.extension).toBe("m4a");
  });

  test("release detiene la grabación en curso, libera las pistas y es idempotente", async () => {
    const { env, pistas } = entorno();
    const grabador = createWebWindowRecorder(env);
    await grabador.available();
    await grabador.start();
    grabador.release();
    grabador.release();
    expect(FakeRecorder.creados[0]?.state).toBe("inactive");
    expect(pistas.detenidas).toBe(1);
  });
});
