import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { stopSpeaking } from "@/features/asistente/speaker";
import { VoiceMessageMachine } from "@/features/asistente/voice-message";
import { createWindowRecorder } from "@/features/voz/create-window-recorder";
import { LISTEN_BLOCK_REASON, useMicLockStore } from "@/features/voz/mic-lock-store";
import { useElapsed } from "@/features/voz/use-elapsed";

/**
 * Mensaje de voz del chat (tarea 7.3): conecta la máquina de estados con React. El micrófono lo
 * libera al desmontar. El motivo de bloqueo viene de la escucha de consulta (`mic-lock-store`).
 */
export function useVoiceMessage() {
  const machine = useRef<VoiceMessageMachine | null>(null);
  if (machine.current === null) {
    machine.current = new VoiceMessageMachine({
      recorder: createWindowRecorder(),
      now: () => Date.now(),
      isBlocked: () => (useMicLockStore.getState().listenActive ? LISTEN_BLOCK_REASON : null),
      setTimer: (callback, ms) => setTimeout(callback, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    });
  }
  const current = machine.current;
  const { state, notice } = useSyncExternalStore(
    (listener) => current.subscribe(listener),
    () => current.getSnapshot(),
    () => current.getSnapshot(),
  );
  // Se suscribe al bloqueo para que el botón se deshabilite al empezar la escucha.
  const blockedReason = useMicLockStore((s) => (s.listenActive ? LISTEN_BLOCK_REASON : null));
  const elapsed = useElapsed(state.kind === "recording" ? state.startedAt : null);

  useEffect(() => () => current.dispose(), [current]);

  return {
    state,
    notice,
    elapsed,
    blockedReason,
    // Grabar corta la voz del asistente: el micrófono la captaría.
    start: useCallback(() => {
      stopSpeaking();
      return current.start();
    }, [current]),
    stop: useCallback(() => current.stop(), [current]),
    cancel: useCallback(() => current.cancel(), [current]),
    discard: useCallback(() => current.discard(), [current]),
    beginSend: useCallback(() => current.beginSend(), [current]),
    sendFailed: useCallback(() => current.sendFailed(), [current]),
    sendDone: useCallback(() => current.sendDone(), [current]),
    dismissNotice: useCallback(() => current.dismissNotice(), [current]),
    showNotice: useCallback(
      (n: Parameters<typeof current.showNotice>[0]) => current.showNotice(n),
      [current],
    ),
  };
}

export type VoiceMessageApi = ReturnType<typeof useVoiceMessage>;
