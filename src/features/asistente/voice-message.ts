import type { AudioPayload } from "@/features/voz/transcription-port";
import type { WindowRecorder } from "@/features/voz/window-recorder";

/**
 * Máquina de estados de un mensaje de voz del chat (asistente-conversacional «Grabar, revisar y
 * enviar audio» · design.md D5 · tarea 7.3): `idle → recording → review → sending`. Reutiliza el
 * `WindowRecorder` de la escucha (`MediaRecorder` en web, `expo-audio` en nativo). Pura: el grabador,
 * el reloj y el temporizador entran por parámetro, así que se prueba sin micrófono.
 */
export const MIN_VOICE_MS = 1000;
export const MAX_VOICE_MS = 120_000;

export type VoiceNotice = "too-short" | "unavailable" | "blocked" | "not-understood" | "busy";

export type VoiceState =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "review"; payload: AudioPayload; durationMs: number; autoStopped: boolean }
  | { kind: "sending"; payload: AudioPayload; durationMs: number };

export type VoiceMessageDeps = {
  recorder: WindowRecorder;
  now: () => number;
  /** Motivo si el micrófono lo usa otra función (la escucha de una consulta); `null` si está libre. */
  isBlocked: () => string | null;
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

export class VoiceMessageMachine {
  #state: VoiceState = { kind: "idle" };
  #notice: VoiceNotice | null = null;
  #snapshot: { state: VoiceState; notice: VoiceNotice | null } = {
    state: this.#state,
    notice: this.#notice,
  };
  #timer: unknown = null;
  /** Reentrada: `start` y `stop` esperan al micrófono, y una segunda llamada en ese lapso se ignora. */
  #busy: "starting" | "stopping" | null = null;
  #disposed = false;
  readonly #listeners = new Set<(state: VoiceState) => void>();

  constructor(private readonly deps: VoiceMessageDeps) {}

  getState(): VoiceState {
    return this.#state;
  }

  getNotice(): VoiceNotice | null {
    return this.#notice;
  }

  /** Estado y aviso juntos; el mismo objeto hasta el siguiente cambio (para `useSyncExternalStore`). */
  getSnapshot(): { state: VoiceState; notice: VoiceNotice | null } {
    return this.#snapshot;
  }

  /** Por qué el botón de grabar está deshabilitado (un solo micrófono), o `null`. */
  blockedReason(): string | null {
    return this.deps.isBlocked();
  }

  subscribe(listener: (state: VoiceState) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Un aviso que viene de fuera de la máquina (p. ej. la transcripción salió ininteligible). */
  showNotice(notice: VoiceNotice) {
    this.#set(this.#state, notice);
  }

  dismissNotice() {
    this.#set(this.#state, null);
  }

  async start() {
    if (this.#disposed || this.#busy !== null || this.#state.kind !== "idle") return;
    this.#busy = "starting";
    try {
      if (this.deps.isBlocked() !== null) {
        this.#set(this.#state, "blocked");
        return;
      }
      // FR-054: sin permiso o dispositivo se dice y se ofrece escribir; nunca se queda a medias.
      if (!(await this.deps.recorder.available())) {
        if (!this.#disposed) this.#set(this.#state, "unavailable");
        return;
      }
      try {
        await this.deps.recorder.start();
      } catch {
        this.deps.recorder.release();
        if (!this.#disposed) this.#set(this.#state, "unavailable");
        return;
      }
      // Se desmontó mientras se abría el micrófono: se libera de inmediato, no queda abierto.
      if (this.#disposed) {
        this.deps.recorder.release();
        return;
      }
      this.#timer = this.deps.setTimer(() => void this.#finish(true), MAX_VOICE_MS);
      this.#set({ kind: "recording", startedAt: this.deps.now() }, null);
    } finally {
      this.#busy = null;
    }
  }

  /** «Detener»: termina la grabación y pasa a revisión (o la descarta si dura menos de 1 s). */
  async stop() {
    await this.#finish(false);
  }

  /** «Cancelar» durante la grabación: libera el micrófono y no guarda nada. */
  cancel() {
    if (this.#state.kind !== "recording") return;
    this.#clearTimer();
    this.deps.recorder.release();
    this.#set({ kind: "idle" }, null);
  }

  /** «Descartar» en revisión. */
  discard() {
    if (this.#state.kind !== "review") return;
    this.#set({ kind: "idle" }, null);
  }

  /** «Enviar»: entrega el audio una sola vez; fuera de revisión devuelve `null`. */
  beginSend(): { payload: AudioPayload; durationMs: number } | null {
    const state = this.#state;
    if (state.kind !== "review") return null;
    this.#set({ kind: "sending", payload: state.payload, durationMs: state.durationMs }, null);
    return { payload: state.payload, durationMs: state.durationMs };
  }

  /** El envío falló: se vuelve a la revisión con el mismo audio para reintentar. */
  sendFailed() {
    const state = this.#state;
    if (state.kind !== "sending") return;
    this.#set(
      { kind: "review", payload: state.payload, durationMs: state.durationMs, autoStopped: false },
      null,
    );
  }

  sendDone() {
    if (this.#state.kind !== "sending") return;
    this.#set({ kind: "idle" }, null);
  }

  /** Libera el micrófono y el temporizador (al desmontar). */
  dispose() {
    this.#disposed = true;
    this.#clearTimer();
    this.deps.recorder.release();
    this.#listeners.clear();
  }

  async #finish(autoStopped: boolean) {
    const state = this.#state;
    // Detener a mano y el corte automático pueden coincidir: solo uno llama a `recorder.stop()`.
    if (state.kind !== "recording" || this.#busy !== null) return;
    this.#busy = "stopping";
    try {
      this.#clearTimer();
      // La duración nunca pasa del máximo aunque el temporizador llegue tarde.
      const durationMs = Math.min(this.deps.now() - state.startedAt, MAX_VOICE_MS);
      let payload: AudioPayload;
      try {
        payload = await this.deps.recorder.stop();
      } catch {
        this.deps.recorder.release();
        this.#set({ kind: "idle" }, "unavailable");
        return;
      }
      if (this.#disposed) {
        this.deps.recorder.release();
        return;
      }
      if (durationMs < MIN_VOICE_MS) {
        this.#set({ kind: "idle" }, "too-short");
        return;
      }
      this.#set({ kind: "review", payload, durationMs, autoStopped }, null);
    } finally {
      this.#busy = null;
    }
  }

  #clearTimer() {
    if (this.#timer !== null) this.deps.clearTimer(this.#timer);
    this.#timer = null;
  }

  #set(state: VoiceState, notice: VoiceNotice | null) {
    this.#state = state;
    this.#notice = notice;
    this.#snapshot = { state, notice };
    for (const listener of this.#listeners) listener(state);
  }
}
