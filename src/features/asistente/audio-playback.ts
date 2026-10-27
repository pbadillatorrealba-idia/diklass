import type { AudioPayload } from "@/features/voz/transcription-port";

/**
 * Reproducción del audio en revisión (tarea 7.4). Interfaz común: en web `HTMLAudioElement`
 * (`audio-playback.web.ts`) y en nativo `expo-audio`. El módulo nativo se carga de forma diferida (no
 * existe en pruebas ni en web) y su enlace real solo se ejerce en dispositivo (verificación 8.4).
 */
export type AudioPlayback = {
  play(): void;
  pause(): void;
  /** Avisa cuando termina de reproducirse. */
  onEnded(callback: () => void): void;
  /** Libera el reproductor y sus recursos. */
  dispose(): void;
};

/** De dónde sale el audio: lo recién grabado (revisión) o una URL firmada de un mensaje enviado. */
export type AudioSource = { payload: AudioPayload } | { url: string };

export function createAudioPlayback(source: AudioSource): AudioPlayback {
  const uri = "payload" in source ? source.payload.uri : source.url;
  let ended: (() => void) | null = null;
  let player: {
    play(): void;
    pause(): void;
    remove(): void;
    addListener(
      event: "playbackStatusUpdate",
      cb: (s: { didJustFinish?: boolean }) => void,
    ): {
      remove(): void;
    };
  } | null = null;
  let listener: { remove(): void } | null = null;
  let pendiente: "play" | null = null;
  const cargar = import("expo-audio").then(({ createAudioPlayer }) => {
    if (!uri) return;
    player = createAudioPlayer({ uri }) as unknown as typeof player;
    listener =
      player?.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) ended?.();
      }) ?? null;
    if (pendiente === "play") player?.play();
  });
  void cargar.catch(() => {});
  return {
    play() {
      if (player) player.play();
      else pendiente = "play";
    },
    pause() {
      pendiente = null;
      player?.pause();
    },
    onEnded(callback) {
      ended = callback;
    },
    dispose() {
      listener?.remove();
      player?.remove();
      player = null;
    },
  };
}
