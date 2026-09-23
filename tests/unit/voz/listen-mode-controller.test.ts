import { describe, expect, test } from "bun:test";
import { ListenModeController } from "@/features/voz/listen-mode-controller";
import type { AudioWindow, TranscriptResult } from "@/features/voz/transcription-port";

// Tasks.md 3.3 — controlador del modo de escucha (D3 · FR-015 · FR-025 · FR-054 · FR-055 ·
// US6-AC2 · US6-AC5 · US6-AC10 · US6-AC11 · US6-AC12 · SC-028).

const ventana = (seq: number): AudioWindow => ({
  listenSessionId: "sesion-1",
  seq,
  startedAt: `2026-09-22T10:0${seq}:00.000Z`,
  durationMs: 30_000,
});

class FuenteFija {
  readonly eventos: string[] = [];
  constructor(
    readonly cantidad: number,
    readonly disponible = true,
  ) {}
  available(): Promise<boolean> {
    return Promise.resolve(this.disponible);
  }
  async *windows(signal?: AbortSignal): AsyncIterable<AudioWindow> {
    for (let seq = 0; seq < this.cantidad; seq++) {
      if (signal?.aborted) {
        return;
      }
      this.eventos.push(`ventana:${seq}`);
      yield ventana(seq);
    }
  }
}

class TranscripciónFija {
  readonly eventos: string[] = [];
  constructor(private readonly alTranscribir?: (window: AudioWindow) => void) {}
  transcribe(window: AudioWindow): Promise<TranscriptResult> {
    this.eventos.push(`transcrito:${window.seq}`);
    this.alTranscribir?.(window);
    return Promise.resolve({ text: `texto ${window.seq}`, quality: "ok" });
  }
}

describe("ListenModeController", () => {
  test("SC-028 · FR-015: el tramo N queda procesado antes de que se abra el tramo N+1", async () => {
    const fuente = new FuenteFija(3);
    const transcripcion = new TranscripciónFija();
    const eventos: string[] = [];
    const controlador = new ListenModeController({
      source: fuente,
      transcription: transcripcion,
      processWindow: (window) => {
        eventos.push(`procesado:${window.seq}`);
        return Promise.resolve();
      },
    });
    await controlador.run();
    for (let seq = 0; seq < 2; seq++) {
      const procesado = eventos.indexOf(`procesado:${seq}`);
      const siguiente = fuente.eventos.indexOf(`ventana:${seq + 1}`);
      expect(procesado).toBeGreaterThanOrEqual(0);
      expect(procesado).toBeLessThan(siguiente);
    }
    expect(controlador.state).toBe("detenido");
  });

  test("presupuesto: procesar cada ventana ≤ 2 s (adaptador simulado)", async () => {
    const fuente = new FuenteFija(3);
    const inicio = performance.now();
    const controlador = new ListenModeController({
      source: fuente,
      transcription: new TranscripciónFija(),
      processWindow: () => Promise.resolve(),
    });
    await controlador.run();
    expect((performance.now() - inicio) / 3).toBeLessThanOrEqual(2_000);
  });

  test("FR-054 · US6-AC10: con la captura no disponible el estado es no_disponible y nada se procesa", async () => {
    const fuente = new FuenteFija(3, false);
    let procesados = 0;
    const controlador = new ListenModeController({
      source: fuente,
      transcription: new TranscripciónFija(),
      processWindow: () => {
        procesados += 1;
        return Promise.resolve();
      },
    });
    const estado = await controlador.run();
    expect(estado).toBe("no_disponible");
    expect(procesados).toBe(0);
  });

  test("FR-025 · US6-AC5: detener deja el estado detenido y lo indica por callback", async () => {
    const fuente = new FuenteFija(2);
    const estados: string[] = [];
    const controlador = new ListenModeController({
      source: fuente,
      transcription: new TranscripciónFija(),
      processWindow: () => Promise.resolve(),
      onState: (estado) => estados.push(estado),
    });
    await controlador.run();
    expect(estados).toEqual(["capturando", "detenido"]);
  });

  test("US6-AC11 · FR-055: en una consulta larga se conservan los antecedentes de los primeros tramos", async () => {
    const fuente = new FuenteFija(6);
    const procesados: number[] = [];
    const controlador = new ListenModeController({
      source: fuente,
      transcription: new TranscripciónFija(),
      processWindow: (window) => {
        procesados.push(window.seq);
        return Promise.resolve();
      },
    });
    await controlador.run();
    expect(procesados).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test("US6-AC12 · FR-055: la interrupción a mitad de tramo se resuelve de forma explícita, sin tramos a medio procesar", async () => {
    const fuente = new FuenteFija(3);
    const procesados: number[] = [];
    const parciales: { seq: number; decision: string }[] = [];
    let controlador: ListenModeController;
    const transcripcion = new TranscripciónFija((window) => {
      if (window.seq === 1) {
        void controlador?.stop("discarded");
      }
    });
    controlador = new ListenModeController({
      source: fuente,
      transcription: transcripcion,
      processWindow: (window) => {
        procesados.push(window.seq);
        return Promise.resolve();
      },
      settlePartialWindow: (window, _result, decision) => {
        parciales.push({ seq: window.seq, decision });
        return Promise.resolve();
      },
    });
    await controlador.run();
    expect(procesados).toEqual([0]);
    expect(parciales).toEqual([{ seq: 1, decision: "discarded" }]);
    expect(controlador.state).toBe("detenido");
    expect(controlador.wasInterrupted).toBe(true);
  });

  test("US6-AC12: la decisión del tramo interrumpido puede ser 'processed' (explícita, nunca a medio camino)", async () => {
    const fuente = new FuenteFija(2);
    const decisiones: string[] = [];
    let controlador: ListenModeController;
    const transcripcion = new TranscripciónFija((window) => {
      if (window.seq === 0) {
        void controlador?.stop("processed");
      }
    });
    controlador = new ListenModeController({
      source: fuente,
      transcription: transcripcion,
      processWindow: () => Promise.resolve(),
      settlePartialWindow: (_window, _result, decision) => {
        decisiones.push(decision);
        return Promise.resolve();
      },
    });
    await controlador.run();
    expect(decisiones).toEqual(["processed"]);
    expect(controlador.wasInterrupted).toBe(true);
  });

  test("el fin natural de la captura NO es una interrupción (detención normal ≠ interrupción)", async () => {
    const controlador = new ListenModeController({
      source: new FuenteFija(2),
      transcription: new TranscripciónFija(),
      processWindow: () => Promise.resolve(),
    });
    await controlador.run();
    expect(controlador.wasInterrupted).toBe(false);
  });
});
