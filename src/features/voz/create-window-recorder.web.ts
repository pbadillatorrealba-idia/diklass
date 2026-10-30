import type { AudioPayload } from "@/features/voz/transcription-port";
import type { WindowRecorder } from "@/features/voz/window-recorder";

/** Lo que usa del navegador: se inyecta en las pruebas. */
export type WebMediaEnv = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  MediaRecorder: typeof MediaRecorder;
};

/** Formatos de `MediaRecorder` que acepta la función `transcribe-audio`, por preferencia. */
const FORMATOS = [
  { mime: "audio/webm;codecs=opus", base: "audio/webm", extension: "webm" },
  { mime: "audio/webm", base: "audio/webm", extension: "webm" },
  // Safari solo graba MP4/AAC.
  { mime: "audio/mp4", base: "audio/mp4", extension: "m4a" },
] as const;

function entornoDelNavegador(): WebMediaEnv | null {
  const mediaDevices = globalThis.navigator?.mediaDevices;
  if (!mediaDevices?.getUserMedia || typeof globalThis.MediaRecorder === "undefined") return null;
  return {
    getUserMedia: (constraints) => mediaDevices.getUserMedia(constraints),
    MediaRecorder: globalThis.MediaRecorder,
  };
}

/**
 * Grabador web (D2): un `MediaRecorder` NUEVO por ventana sobre el mismo `MediaStream`, porque
 * los fragmentos de un solo grabador con `timeslice` no son archivos válidos por sí solos.
 * El micrófono exige `localhost` o HTTPS.
 */
export function createWebWindowRecorder(
  env: WebMediaEnv | null = entornoDelNavegador(),
): WindowRecorder {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let formato: (typeof FORMATOS)[number] | null = null;
  let chunks: Blob[] = [];

  const abrirMicrofono = async (): Promise<boolean> => {
    if (!env) return false;
    formato = FORMATOS.find((f) => env.MediaRecorder.isTypeSupported(f.mime)) ?? null;
    if (!formato) return false;
    if (stream) return true;
    try {
      stream = await env.getUserMedia({ audio: true });
      return true;
    } catch {
      // Permiso denegado o sin dispositivo: la señal de FR-054.
      return false;
    }
  };

  return {
    available: abrirMicrofono,

    async start() {
      if (!env || !formato || !stream) throw new Error("El micrófono no está disponible.");
      chunks = [];
      recorder = new env.MediaRecorder(stream, { mimeType: formato.mime });
      recorder.ondataavailable = (evento) => {
        if (evento.data.size > 0) chunks.push(evento.data);
      };
      recorder.start();
    },

    stop() {
      const actual = recorder;
      const usado = formato;
      if (!actual || !usado) return Promise.reject(new Error("No hay una grabación en curso."));
      recorder = null;
      const empaquetar = async (): Promise<AudioPayload> => ({
        data: await new Blob(chunks, { type: usado.base }).arrayBuffer(),
        mimeType: usado.base,
        extension: usado.extension,
      });
      // El navegador pudo cortar la grabación solo (micrófono desconectado, flujo cerrado): ya
      // entregó lo grabado y `stop()` lanzaría `InvalidStateError`; se devuelve lo acumulado.
      if (actual.state === "inactive") return empaquetar();
      return new Promise((resolve, reject) => {
        actual.onstop = () => void empaquetar().then(resolve, reject);
        actual.onerror = () => reject(new Error("La grabación del micrófono falló."));
        actual.stop();
      });
    },

    release() {
      if (recorder && recorder.state !== "inactive") recorder.stop();
      recorder = null;
      for (const pista of stream?.getTracks() ?? []) pista.stop();
      stream = null;
    },
  };
}

export const createWindowRecorder = (): WindowRecorder => createWebWindowRecorder();
