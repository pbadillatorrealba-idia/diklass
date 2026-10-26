import type { WindowRecorder } from "@/features/voz/window-recorder";

/**
 * Grabador nativo (iOS/Android, D2 del cambio implementar-asr-real-captura-voz) sobre `expo-audio`.
 * En web Metro resuelve `create-window-recorder.web.ts`. El módulo de audio se inyecta para probar
 * el ciclo sin dispositivo; su enlace real (`expoAudio`) es delgado y solo se ejerce en dispositivo
 * (verificación manual pendiente, tarea 7.3).
 */
export type NativeRecorder = {
  prepare(): Promise<void>;
  record(): void;
  /** Termina la grabación y devuelve el URI del archivo. */
  stop(): Promise<string | null>;
};

export type NativeAudio = {
  requestPermission(): Promise<boolean>;
  setRecordingMode(activo: boolean): Promise<void>;
  createRecorder(): NativeRecorder;
  readFile(uri: string): Promise<Blob>;
};

export function createNativeWindowRecorder(audio: NativeAudio): WindowRecorder {
  let recorder: NativeRecorder | null = null;
  let modoActivo = false;

  return {
    async available() {
      try {
        if (!(await audio.requestPermission())) return false;
        await audio.setRecordingMode(true);
        modoActivo = true;
        return true;
      } catch {
        return false;
      }
    },

    async start() {
      recorder = audio.createRecorder();
      await recorder.prepare();
      recorder.record();
    },

    async stop() {
      const actual = recorder;
      if (!actual) throw new Error("No hay una grabación en curso.");
      recorder = null;
      const uri = await actual.stop();
      if (!uri) throw new Error("La grabación no produjo un archivo.");
      const archivo = await audio.readFile(uri);
      return {
        blob: new Blob([archivo], { type: "audio/mp4" }),
        mimeType: "audio/mp4",
        extension: "m4a",
      };
    },

    release() {
      const actual = recorder;
      recorder = null;
      void actual?.stop().catch(() => {});
      if (modoActivo) {
        modoActivo = false;
        void audio.setRecordingMode(false).catch(() => {});
      }
    },
  };
}

/** Voz de consulta: mono a 16 kHz y 32 kbps bastan para ASR y mantienen ~120 KB por ventana de 30 s. */
async function expoAudio(): Promise<NativeAudio> {
  const { AudioModule, RecordingPresets } = await import("expo-audio");
  const opciones = {
    ...RecordingPresets.HIGH_QUALITY,
    sampleRate: 16_000,
    numberOfChannels: 1,
    bitRate: 32_000,
  };
  return {
    requestPermission: async () => (await AudioModule.requestRecordingPermissionsAsync()).granted,
    setRecordingMode: (activo) =>
      AudioModule.setAudioModeAsync({ allowsRecording: activo, playsInSilentMode: activo }),
    createRecorder: () => {
      const grabadora = new AudioModule.AudioRecorder(opciones);
      return {
        prepare: () => grabadora.prepareToRecordAsync(),
        record: () => grabadora.record(),
        stop: async () => {
          await grabadora.stop();
          return grabadora.uri;
        },
      };
    },
    // `fetch` de React Native lee archivos locales como Blob.
    readFile: async (uri) => (await fetch(uri)).blob(),
  };
}

export function createWindowRecorder(): WindowRecorder {
  // El módulo nativo se carga de forma diferida (no existe en pruebas ni en web).
  let real: Promise<WindowRecorder> | null = null;
  const cargar = () => {
    real ??= expoAudio().then(createNativeWindowRecorder);
    return real;
  };
  return {
    available: async () => (await cargar()).available(),
    start: async () => (await cargar()).start(),
    stop: async () => (await cargar()).stop(),
    release: () => void cargar().then((grabador) => grabador.release()),
  };
}
