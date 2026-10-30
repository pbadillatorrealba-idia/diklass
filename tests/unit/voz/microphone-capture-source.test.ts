import { describe, expect, test } from "bun:test";
import { MicrophoneCaptureSource } from "@/features/voz/microphone-capture-source";
import type { AudioWindow } from "@/features/voz/transcription-port";
import type { WindowRecorder } from "@/features/voz/window-recorder";

const SESION = "59999999-0000-4000-8000-000000000001";

/** Grabador falso: registra el orden de las llamadas y cuántas grabaciones hay corriendo. */
function grabadorFalso(opciones: { disponible?: boolean; fallaReinicio?: boolean } = {}) {
  const eventos: string[] = [];
  let grabando = 0;
  let maxSimultaneas = 0;
  const recorder: WindowRecorder = {
    available: async () => opciones.disponible ?? true,
    start: async () => {
      if (opciones.fallaReinicio && eventos.includes("stop")) {
        throw new Error("dispositivo ocupado");
      }
      grabando += 1;
      maxSimultaneas = Math.max(maxSimultaneas, grabando);
      eventos.push("start");
    },
    stop: async () => {
      grabando -= 1;
      eventos.push("stop");
      return {
        data: new Uint8Array(8).buffer,
        mimeType: "audio/webm",
        extension: "webm" as const,
      };
    },
    // release() detiene cualquier grabación en curso y libera el micrófono.
    release: () => {
      grabando = 0;
      eventos.push("release");
    },
  };
  return { recorder, eventos, enCurso: () => grabando, maxSimultaneas: () => maxSimultaneas };
}

const fuente = (recorder: WindowRecorder, windowMs = 20) =>
  new MicrophoneCaptureSource({ recorder, listenSessionId: SESION, windowMs });

describe("MicrophoneCaptureSource (D2)", () => {
  test("FR-054: sin permiso o sin dispositivo la fuente no está disponible", async () => {
    expect(await fuente(grabadorFalso({ disponible: false }).recorder).available()).toBe(false);
    expect(await fuente(grabadorFalso().recorder).available()).toBe(true);
  });

  test("emite ventanas autocontenidas con seq correlativo y audio", async () => {
    const g = grabadorFalso();
    const control = new AbortController();
    const ventanas = [];
    for await (const ventana of fuente(g.recorder).windows(control.signal)) {
      ventanas.push(ventana);
      if (ventanas.length === 3) control.abort();
    }
    // 3 completas + la parcial entregada al abortar.
    expect(ventanas.map((v) => v.seq)).toEqual([0, 1, 2, 3]);
    expect(ventanas.every((v) => v.listenSessionId === SESION)).toBe(true);
    expect(ventanas.every((v) => v.audio?.extension === "webm")).toBe(true);
    expect(ventanas[0]?.durationMs).toBeGreaterThanOrEqual(15);
  });

  test("la grabación siguiente ya corre cuando se entrega la ventana (sin huecos)", async () => {
    const g = grabadorFalso();
    const control = new AbortController();
    for await (const _ventana of fuente(g.recorder).windows(control.signal)) {
      // Mientras el consumidor «transcribe», debe haber una grabación en curso (salvo el parcial
      // final, que no reinicia).
      if (!control.signal.aborted) {
        expect(g.enCurso()).toBe(1);
        control.abort();
      }
    }
    expect(g.maxSimultaneas()).toBe(1);
  });

  test("US6-AC5 · FR-055: abortar entrega el tramo parcial y libera el micrófono", async () => {
    const g = grabadorFalso();
    const control = new AbortController();
    const ventanas: AudioWindow[] = [];
    const consumo = (async () => {
      for await (const ventana of fuente(g.recorder, 5_000).windows(control.signal)) {
        ventanas.push(ventana);
      }
    })();
    await Bun.sleep(30);
    control.abort();
    await consumo;
    expect(ventanas).toHaveLength(1);
    expect(ventanas[0]?.seq).toBe(0);
    expect(ventanas[0]?.durationMs).toBeLessThan(1_000);
    expect(g.eventos.at(-1)).toBe("release");
    expect(g.enCurso()).toBe(0);
  });

  test("abortar mientras el consumidor procesa entrega igualmente el tramo en curso", async () => {
    const g = grabadorFalso();
    const control = new AbortController();
    const seqs: number[] = [];
    for await (const ventana of fuente(g.recorder).windows(control.signal)) {
      seqs.push(ventana.seq);
      if (ventana.seq === 0) {
        // El usuario detiene mientras se transcribía el tramo 0.
        control.abort();
      }
    }
    expect(seqs).toEqual([0, 1]);
    expect(g.enCurso()).toBe(0);
  });

  test("si el consumidor corta el recorrido, el micrófono se libera", async () => {
    const g = grabadorFalso();
    for await (const _ventana of fuente(g.recorder).windows()) {
      break;
    }
    expect(g.eventos.at(-1)).toBe("release");
    expect(g.enCurso()).toBe(0);
  });

  test("FR-055: si reiniciar la grabación falla, la ventana ya grabada se entrega y luego se propaga el error", async () => {
    const g = grabadorFalso({ fallaReinicio: true });
    const entregadas: number[] = [];
    let error: unknown;
    try {
      for await (const ventana of fuente(g.recorder).windows()) {
        entregadas.push(ventana.seq);
      }
    } catch (e) {
      error = e;
    }
    expect(entregadas).toEqual([0]);
    expect((error as Error).message).toBe("dispositivo ocupado");
    expect(g.eventos.at(-1)).toBe("release");
  });
});
