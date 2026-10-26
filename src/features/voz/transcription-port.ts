import type { TranscriptQuality } from "@/features/voz/schema";

/**
 * Puerto de transcripción (D2 del diseño del cambio, FR-015).
 *
 * Implementación por defecto `SimulatedTranscriptionAdapter`, determinista sobre el guion de la
 * conversación de referencia (datos sintéticos; nada de audio real es requisito del PoC).
 * La transcripción real es `RemoteTranscriptionAdapter` (`remote-transcription-adapter.ts`): envía
 * `AudioWindow.audio` a la Edge Function `transcribe-audio` y devuelve texto + calidad; se inyecta
 * en el controlador de escucha sin tocar el resto del pipeline (`listen-mode-inputs.ts` elige).
 */

/** Audio de una ventana (D2 del cambio implementar-asr-real-captura-voz): un archivo autocontenido. */
export type AudioPayload = {
  blob: Blob;
  mimeType: string;
  /** Extensión canónica: la ruta de Storage del tramo la usa (migración 019). */
  extension: "webm" | "m4a";
};

/** Ventana de captura de ~30 s (D3 · brief §5): una unidad de transcripción incremental. */
export type AudioWindow = {
  listenSessionId: string;
  seq: number;
  startedAt: string;
  durationMs: number;
  /** Ausente en la captura simulada; el archivo de la ventana con el micrófono real. */
  audio?: AudioPayload;
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
