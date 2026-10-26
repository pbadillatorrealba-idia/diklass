import { type CaptureSource, WINDOW_MS } from "@/features/voz/capture-source";
import type { AudioWindow } from "@/features/voz/transcription-port";
import type { WindowRecorder } from "@/features/voz/window-recorder";

type MicrophoneCaptureSourceOptions = {
  recorder: WindowRecorder;
  listenSessionId: string;
  windowMs?: number;
};

/** Espera hasta `ms` o hasta que se aborte, lo que ocurra primero. */
function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, Math.max(0, ms));
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

/**
 * Captura real del micrófono (D2 del cambio implementar-asr-real-captura-voz, FR-014 · FR-054 ·
 * FR-055). Emite una ventana autocontenida cada `windowMs`.
 *
 * El controlador procesa cada tramo antes de pedir el siguiente, así que la grabación siguiente se
 * reinicia ANTES de entregar la ventana: el micrófono nunca queda sin grabar mientras se
 * transcribe. Al abortar (detener, FR-025) se entrega el tramo parcial como última ventana, para
 * que el controlador lo resuelva de forma explícita (FR-055), y se libera el micrófono siempre.
 * `ponytail`: entre el stop y el start de cada ventana hay un hueco de pocos milisegundos que
 * puede cortar una palabra; un solapamiento corregiría eso si la calidad lo exige.
 */
export class MicrophoneCaptureSource implements CaptureSource {
  readonly #recorder: WindowRecorder;
  readonly #listenSessionId: string;
  readonly #windowMs: number;

  constructor(options: MicrophoneCaptureSourceOptions) {
    this.#recorder = options.recorder;
    this.#listenSessionId = options.listenSessionId;
    this.#windowMs = options.windowMs ?? WINDOW_MS;
  }

  available(): Promise<boolean> {
    return this.#recorder.available();
  }

  async *windows(signal?: AbortSignal): AsyncIterable<AudioWindow> {
    try {
      let startedAt = Date.now();
      await this.#recorder.start();
      for (let seq = 0; ; seq++) {
        await esperar(startedAt + this.#windowMs - Date.now(), signal);
        const aborted = signal?.aborted ?? false;
        const audio = await this.#recorder.stop();
        const window: AudioWindow = {
          listenSessionId: this.#listenSessionId,
          seq,
          startedAt: new Date(startedAt).toISOString(),
          durationMs: Date.now() - startedAt,
          audio,
        };
        if (!aborted) {
          startedAt = Date.now();
          await this.#recorder.start();
        }
        yield window;
        if (aborted) return;
      }
    } finally {
      this.#recorder.release();
    }
  }
}
