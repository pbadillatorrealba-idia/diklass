import type { TranscriptQuality } from "@/features/voz/schema";

/**
 * Puerto de transcripción (D2 del diseño del cambio, FR-015).
 *
 * Implementación por defecto `SimulatedTranscriptionAdapter`, determinista sobre el guion de la
 * conversación de referencia (datos sintéticos; nada de audio real es requisito del PoC).
 * Extensión documentada, SIN implementar: un adaptador a un servicio real de ASR que materialice
 * `AudioWindow.audio` y devuelva texto + calidad; se inyecta en el controlador de escucha sin
 * tocar el resto del pipeline. Decisión dura reversible (Principio III: sin dependencias nuevas
 * sin requisito).
 */

/** Ventana de captura de ~30 s (D3 · brief §5): una unidad de transcripción incremental. */
export type AudioWindow = {
  listenSessionId: string;
  seq: number;
  startedAt: string;
  durationMs: number;
  /** Material de audio opaco: ausente en simulación; bytes/Blob en la extensión de micrófono. */
  audio?: unknown;
};

export type TranscriptResult = { text: string; quality: TranscriptQuality };

export interface TranscriptionPort {
  transcribe(window: AudioWindow): Promise<TranscriptResult>;
}

export type GuiónTramo = {
  seq: number;
  calidad: TranscriptQuality;
  transcripcion: string;
};

export type GuiónConversación = { guion: GuiónTramo[] };

/**
 * Adaptador simulado y determinista (D2): la misma ventana produce siempre la misma
 * transcripción y conserva la marca de calidad del tramo del guion (FR-031).
 */
export class SimulatedTranscriptionAdapter implements TranscriptionPort {
  readonly #tramos: Map<number, GuiónTramo>;

  constructor(guion: GuiónConversación) {
    this.#tramos = new Map(guion.guion.map((tramo) => [tramo.seq, tramo]));
  }

  transcribe(window: AudioWindow): Promise<TranscriptResult> {
    const tramo = this.#tramos.get(window.seq);
    if (!tramo) {
      // Constitución IV: la ventana desconocida falla de forma explícita, nunca en silencio.
      return Promise.reject(
        new Error(`Tramo ${window.seq} fuera del guion de la conversación de referencia (D2)`),
      );
    }
    return Promise.resolve({ text: tramo.transcripcion, quality: tramo.calidad });
  }
}
