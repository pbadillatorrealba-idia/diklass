import type { AudioWindow, GuiónConversación } from "@/features/voz/transcription-port";

/**
 * Fuente de captura del modo de escucha clínica (D3 del diseño, FR-014 · FR-054).
 *
 * `available()` es la señal de indisponibilidad de FR-054: con la captura caída, la interfaz lo
 * indica con claridad y el registro manual de anamnesis queda expedito (US6-AC10). Implementación
 * por defecto `SyntheticCaptureSource` (fixtures sintéticos; el PoC no requiere audio real).
 * Extensión documentada, SIN implementar: `MicrophoneCaptureSource` sobre `expo-audio`, que
 * materializa `AudioWindow.audio` y traduce la denegación de permiso de micrófono a
 * `available() = false`.
 */

export interface CaptureSource {
  available(): Promise<boolean>;
  windows(signal?: AbortSignal): AsyncIterable<AudioWindow>;
}

/** Duración de la ventana de captura: ~30 s (decisión de producto, brief §5). */
export const WINDOW_MS = 30_000;

const INICIO_SINTÉTICO_MS = Date.UTC(2026, 8, 22, 10, 0, 0);

export type SyntheticCaptureSourceOptions = {
  guion: GuiónConversación;
  /** Escenario de indisponibilidad para ejercitar FR-054 · US6-AC10 sin micrófono. */
  unavailable?: boolean;
  windowMs?: number;
  listenSessionId?: string;
  startAtMs?: number;
};

/**
 * Captura sintética determinista (D3): emite una ventana por tramo del guion, con seq correlativo
 * y duración fija, y termina al agotar el guion. Un `AbortSignal` interrumpe la captura a mitad
 * de tramo de forma explícita (FR-055 · US6-AC12).
 */
export class SyntheticCaptureSource implements CaptureSource {
  readonly #guion: GuiónConversación;
  readonly #unavailable: boolean;
  readonly #windowMs: number;
  readonly #listenSessionId: string;
  readonly #startAtMs: number;

  constructor(options: SyntheticCaptureSourceOptions) {
    this.#guion = options.guion;
    this.#unavailable = options.unavailable ?? false;
    this.#windowMs = options.windowMs ?? WINDOW_MS;
    this.#listenSessionId = options.listenSessionId ?? "sesion-sintetica";
    this.#startAtMs = options.startAtMs ?? INICIO_SINTÉTICO_MS;
  }

  available(): Promise<boolean> {
    return Promise.resolve(!this.#unavailable);
  }

  async *windows(signal?: AbortSignal): AsyncIterable<AudioWindow> {
    for (const tramo of this.#guion.guion) {
      if (signal?.aborted) {
        return;
      }
      yield {
        listenSessionId: this.#listenSessionId,
        seq: tramo.seq,
        startedAt: new Date(this.#startAtMs + tramo.seq * this.#windowMs).toISOString(),
        durationMs: this.#windowMs,
      };
    }
  }
}
