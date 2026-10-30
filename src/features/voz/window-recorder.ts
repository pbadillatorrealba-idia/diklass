import type { AudioPayload } from "@/features/voz/transcription-port";

/**
 * Grabador de una ventana de micrófono (D2 del cambio implementar-asr-real-captura-voz): lo único
 * que cambia entre plataformas. Web usa `MediaRecorder` y nativo `expo-audio`; la lógica de
 * ventanas es común (`MicrophoneCaptureSource`).
 */
export interface WindowRecorder {
  /** FR-054: false si se deniega el permiso del micrófono o no hay dispositivo / formato soportado. */
  available(): Promise<boolean>;
  /** Comienza una grabación nueva (un archivo autocontenido). */
  start(): Promise<void>;
  /** Termina la grabación en curso y devuelve su archivo. */
  stop(): Promise<AudioPayload>;
  /** Detiene cualquier grabación en curso y libera el micrófono; idempotente. */
  release(): void;
}
