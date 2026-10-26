import { type CaptureSource, SyntheticCaptureSource } from "@/features/voz/capture-source";
import { createWindowRecorder } from "@/features/voz/create-window-recorder";
import { guionDemo } from "@/features/voz/guion-demo";
import { MicrophoneCaptureSource } from "@/features/voz/microphone-capture-source";
import {
  RemoteTranscriptionAdapter,
  type TranscribeClient,
} from "@/features/voz/remote-transcription-adapter";
import {
  SimulatedTranscriptionAdapter,
  type TranscriptionPort,
} from "@/features/voz/transcription-port";

/**
 * Entradas del modo de escucha (D1 del cambio implementar-asr-real-captura-voz): micrófono +
 * transcripción remota con `EXPO_PUBLIC_VOZ_MODO=real`; en cualquier otro caso el guion simulado,
 * que no necesita micrófono, credencial ni red (pruebas, e2e y CI).
 */
export const esModoReal = (valor: string | undefined) => valor === "real";

/** Expo sustituye `process.env.EXPO_PUBLIC_*` al empaquetar, por eso se lee con esta forma literal. */
export const MODO_REAL = esModoReal(process.env.EXPO_PUBLIC_VOZ_MODO);

/**
 * Duración de la ventana (`EXPO_PUBLIC_VOZ_VENTANA_MS`, opcional): acortarla baja la latencia del
 * primer borrador sin más código (el costo del ASR es por minuto de audio, no por petición). Vacía
 * o inválida conserva los ~30 s del brief (§5).
 */
export const ventanaMs = (valor: string | undefined) => {
  const ms = Number(valor);
  return Number.isFinite(ms) && ms > 0 ? ms : undefined;
};

export const VENTANA_MS = ventanaMs(process.env.EXPO_PUBLIC_VOZ_VENTANA_MS);

export function crearEntradas(
  real: boolean,
  client: TranscribeClient,
  listenSessionId: string,
  windowMs = VENTANA_MS,
): { source: CaptureSource; transcription: TranscriptionPort } {
  if (real) {
    return {
      source: new MicrophoneCaptureSource({
        recorder: createWindowRecorder(),
        listenSessionId,
        windowMs,
      }),
      transcription: new RemoteTranscriptionAdapter(client),
    };
  }
  return {
    source: new SyntheticCaptureSource({ guion: guionDemo, listenSessionId }),
    transcription: new SimulatedTranscriptionAdapter(guionDemo),
  };
}
