import type { CaptureSource } from "@/features/voz/capture-source";
import type {
  AudioWindow,
  TranscriptionPort,
  TranscriptResult,
} from "@/features/voz/transcription-port";

/**
 * Controlador del modo de escucha clínica (D3 del diseño; FR-014 · FR-015 · FR-025 · FR-054 ·
 * FR-055 · SC-028).
 *
 * Recorre las ventanas de captura de ~30 s y, por cada una, transcribe y entrega el resultado a
 * `processWindow` ANTES de abrir el tramo siguiente: el borrador refleja el tramo N antes de que
 * concluya el tramo N+1 (SC-028 · US6-AC2), de modo que la revisión es posible durante la
 * consulta (FR-015 · US6-AC13). Con la captura indisponible el estado es `no_disponible` y el
 * registro manual queda expedito (FR-054 · US6-AC10). Una interrupción a mitad de tramo se
 * resuelve de forma explícita vía `settlePartialWindow` (FR-055 · US6-AC12): procesado o
 * descartado, nunca a medio camino.
 */

export type ListenModeState = "inactivo" | "capturando" | "detenido" | "no_disponible";

export type ListenModeDeps = {
  source: CaptureSource;
  transcription: TranscriptionPort;
  processWindow: (window: AudioWindow, result: TranscriptResult) => Promise<void>;
  settlePartialWindow?: (
    window: AudioWindow,
    result: TranscriptResult,
    decision: "processed" | "discarded",
  ) => Promise<void>;
  onState?: (state: ListenModeState) => void;
};

export class ListenModeController {
  readonly #deps: ListenModeDeps;
  #state: ListenModeState = "inactivo";
  #abort = new AbortController();
  #decision: "processed" | "discarded" = "discarded";
  #interrupted = false;

  constructor(deps: ListenModeDeps) {
    this.#deps = deps;
  }

  get state(): ListenModeState {
    return this.#state;
  }

  /** Interrupción a mitad de tramo (≠ detención normal): US6-AC12 · FR-055. */
  get wasInterrupted(): boolean {
    return this.#interrupted;
  }

  /** Recorre el flujo completo: disponibilidad, ventanas y cierre (fin natural o detención). */
  async run(): Promise<ListenModeState> {
    const disponible = await this.#deps.source.available();
    if (!disponible) {
      this.#cambiarEstado("no_disponible");
      return this.#state;
    }
    this.#abort = new AbortController();
    this.#cambiarEstado("capturando");
    const signal = this.#abort.signal;
    for await (const window of this.#deps.source.windows(signal)) {
      const result = await this.#deps.transcription.transcribe(window);
      if (signal.aborted) {
        // FR-055 · US6-AC12: el tramo interrumpido se resuelve explícitamente, con su
        // transcripción ya disponible: se procesa o se descarta, nunca a medio camino.
        this.#interrupted = true;
        await this.#deps.settlePartialWindow?.(window, result, this.#decision);
        break;
      }
      await this.#deps.processWindow(window, result);
    }
    if (this.#state === "capturando") {
      this.#cambiarEstado("detenido");
    }
    return this.#state;
  }

  /**
   * Detiene la captura (FR-025 · US6-AC5). `decision` resuelve el tramo en curso si la
   * interrupción lo encuentra a mitad (US6-AC12): se procesa o se descarta, explícitamente.
   */
  stop(decision: "processed" | "discarded" = "discarded"): void {
    this.#decision = decision;
    this.#abort.abort();
  }

  #cambiarEstado(estado: ListenModeState): void {
    this.#state = estado;
    this.#deps.onState?.(estado);
  }
}
