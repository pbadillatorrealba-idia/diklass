import type { AudioPlayback, AudioSource } from "@/features/asistente/audio-playback";

export type { AudioPlayback };

/** Reproducción web (tarea 7.4): un `HTMLAudioElement` sobre una URL de objeto del audio grabado. */
export function createAudioPlayback(source: AudioSource): AudioPlayback {
  const objectUrl =
    "payload" in source
      ? URL.createObjectURL(new Blob([source.payload.data], { type: source.payload.mimeType }))
      : null;
  const element = new Audio(objectUrl ?? ("url" in source ? source.url : ""));
  return {
    play: () => void element.play().catch(() => {}),
    pause: () => element.pause(),
    onEnded: (callback) => {
      element.onended = callback;
    },
    dispose: () => {
      element.pause();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
  };
}
