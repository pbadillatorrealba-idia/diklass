import { describe, expect, test } from "bun:test";
import {
  MAX_VOICE_MS,
  MIN_VOICE_MS,
  VoiceMessageMachine,
  type VoiceState,
} from "@/features/asistente/voice-message";
import type { AudioPayload } from "@/features/voz/transcription-port";
import type { WindowRecorder } from "@/features/voz/window-recorder";

const PAYLOAD: AudioPayload = {
  data: new ArrayBuffer(2048),
  mimeType: "audio/webm",
  extension: "webm",
};

function harness(
  over: { available?: boolean; startFalla?: boolean; bloqueado?: string | null } = {},
) {
  let ahora = 1_000_000;
  const llamadas = { available: 0, start: 0, stop: 0, release: 0 };
  let disparar: (() => void) | null = null;
  const recorder: WindowRecorder = {
    available: async () => {
      llamadas.available++;
      return over.available ?? true;
    },
    start: async () => {
      llamadas.start++;
      if (over.startFalla) throw new Error("sin micrófono");
    },
    stop: async () => {
      llamadas.stop++;
      return PAYLOAD;
    },
    release: () => {
      llamadas.release++;
    },
  };
  const machine = new VoiceMessageMachine({
    recorder,
    now: () => ahora,
    isBlocked: () => over.bloqueado ?? null,
    setTimer: (fn) => {
      disparar = fn;
      return 1;
    },
    clearTimer: () => {
      disparar = null;
    },
  });
  const estados: VoiceState["kind"][] = [];
  machine.subscribe((s) => estados.push(s.kind));
  return {
    machine,
    llamadas,
    estados,
    avanzar: (ms: number) => {
      ahora += ms;
    },
    vencerTemporizador: () => disparar?.(),
    hayTemporizador: () => disparar !== null,
  };
}

// asistente-conversacional «Grabar, revisar y enviar audio» (design.md D5 · tarea 7.3).
describe("VoiceMessageMachine", () => {
  test("idle → recording → review", async () => {
    const h = harness();
    await h.machine.start();
    expect(h.machine.getState().kind).toBe("recording");
    h.avanzar(5000);
    await h.machine.stop();
    const estado = h.machine.getState();
    expect(estado.kind).toBe("review");
    expect(estado.kind === "review" && estado.durationMs).toBe(5000);
    expect(estado.kind === "review" && estado.payload).toBe(PAYLOAD);
  });

  test("un audio de menos de 1 s no se envía: se descarta y se avisa", async () => {
    const h = harness();
    await h.machine.start();
    h.avanzar(MIN_VOICE_MS - 1);
    await h.machine.stop();
    expect(h.machine.getState().kind).toBe("idle");
    expect(h.machine.getNotice()).toBe("too-short");
  });

  test("justo 1 s se acepta", async () => {
    const h = harness();
    await h.machine.start();
    h.avanzar(MIN_VOICE_MS);
    await h.machine.stop();
    expect(h.machine.getState().kind).toBe("review");
  });

  test("a los 2 min la grabación se corta sola y pasa a revisión", async () => {
    const h = harness();
    await h.machine.start();
    expect(h.hayTemporizador()).toBe(true);
    h.avanzar(MAX_VOICE_MS);
    h.vencerTemporizador();
    await Promise.resolve();
    await Promise.resolve();
    const estado = h.machine.getState();
    expect(estado.kind).toBe("review");
    expect(estado.kind === "review" && estado.durationMs).toBe(MAX_VOICE_MS);
    expect(estado.kind === "review" && estado.autoStopped).toBe(true);
  });

  test("la duración nunca supera el máximo aunque el temporizador llegue tarde", async () => {
    const h = harness();
    await h.machine.start();
    h.avanzar(MAX_VOICE_MS + 4000);
    await h.machine.stop();
    const estado = h.machine.getState();
    expect(estado.kind === "review" && estado.durationMs).toBe(MAX_VOICE_MS);
  });

  test("detener a mano cancela el temporizador", async () => {
    const h = harness();
    await h.machine.start();
    h.avanzar(3000);
    await h.machine.stop();
    expect(h.hayTemporizador()).toBe(false);
  });

  test("«Cancelar» durante la grabación libera el micrófono y vuelve a idle sin aviso", async () => {
    const h = harness();
    await h.machine.start();
    h.machine.cancel();
    expect(h.machine.getState().kind).toBe("idle");
    expect(h.machine.getNotice()).toBeNull();
    expect(h.llamadas.release).toBeGreaterThan(0);
    expect(h.hayTemporizador()).toBe(false);
  });

  test("«Descartar» en revisión no envía nada y vuelve a idle", async () => {
    const h = harness();
    await h.machine.start();
    h.avanzar(3000);
    await h.machine.stop();
    h.machine.discard();
    expect(h.machine.getState().kind).toBe("idle");
  });

  describe("permiso y dispositivo (FR-054)", () => {
    test("sin permiso o dispositivo avisa «unavailable» y no graba", async () => {
      const h = harness({ available: false });
      await h.machine.start();
      expect(h.machine.getState().kind).toBe("idle");
      expect(h.machine.getNotice()).toBe("unavailable");
      expect(h.llamadas.start).toBe(0);
    });

    test("si arrancar falla, avisa «unavailable» y libera", async () => {
      const h = harness({ startFalla: true });
      await h.machine.start();
      expect(h.machine.getState().kind).toBe("idle");
      expect(h.machine.getNotice()).toBe("unavailable");
      expect(h.llamadas.release).toBeGreaterThan(0);
    });
  });

  describe("un solo micrófono (escucha de consulta activa)", () => {
    test("bloqueado no graba y avisa «blocked»", async () => {
      const h = harness({ bloqueado: "La escucha de la consulta usa el micrófono." });
      await h.machine.start();
      expect(h.machine.getState().kind).toBe("idle");
      expect(h.machine.getNotice()).toBe("blocked");
      expect(h.llamadas.available).toBe(0);
    });

    test("expone el motivo del bloqueo para la interfaz", () => {
      const h = harness({ bloqueado: "La escucha de la consulta usa el micrófono." });
      expect(h.machine.blockedReason()).toBe("La escucha de la consulta usa el micrófono.");
    });
  });

  describe("envío", () => {
    async function enRevision() {
      const h = harness();
      await h.machine.start();
      h.avanzar(4000);
      await h.machine.stop();
      return h;
    }

    test("review → sending entrega el audio y su duración", async () => {
      const h = await enRevision();
      const envio = h.machine.beginSend();
      expect(envio).toEqual({ payload: PAYLOAD, durationMs: 4000 });
      expect(h.machine.getState().kind).toBe("sending");
    });

    test("no se puede enviar dos veces ni fuera de revisión", async () => {
      const h = await enRevision();
      h.machine.beginSend();
      expect(h.machine.beginSend()).toBeNull();
      expect(harness().machine.beginSend()).toBeNull();
    });

    test("si el envío falla vuelve a revisión conservando el audio para reintentar", async () => {
      const h = await enRevision();
      h.machine.beginSend();
      h.machine.sendFailed();
      const estado = h.machine.getState();
      expect(estado.kind).toBe("review");
      expect(estado.kind === "review" && estado.payload).toBe(PAYLOAD);
    });

    test("al terminar el envío vuelve a idle", async () => {
      const h = await enRevision();
      h.machine.beginSend();
      h.machine.sendDone();
      expect(h.machine.getState().kind).toBe("idle");
    });

    test("no se puede descartar ni cancelar mientras se envía", async () => {
      const h = await enRevision();
      h.machine.beginSend();
      h.machine.discard();
      h.machine.cancel();
      expect(h.machine.getState().kind).toBe("sending");
    });
  });

  test("no arranca una grabación si ya hay una en curso o en revisión", async () => {
    const h = harness();
    await h.machine.start();
    await h.machine.start();
    expect(h.llamadas.start).toBe(1);
  });

  test("dispose libera el micrófono y el temporizador", async () => {
    const h = harness();
    await h.machine.start();
    h.machine.dispose();
    expect(h.llamadas.release).toBeGreaterThan(0);
    expect(h.hayTemporizador()).toBe(false);
  });

  test("avisar limpia el aviso al volver a empezar", async () => {
    const h = harness({ available: false });
    await h.machine.start();
    expect(h.machine.getNotice()).toBe("unavailable");
    h.machine.dismissNotice();
    expect(h.machine.getNotice()).toBeNull();
  });

  // `useSyncExternalStore` necesita una instantánea estable entre cambios, y un cambio solo de aviso
  // (idle → idle con otro aviso) también debe notarse.
  test("getSnapshot es estable entre cambios y cambia con un aviso", async () => {
    const h = harness({ available: false });
    const antes = h.machine.getSnapshot();
    expect(h.machine.getSnapshot()).toBe(antes);
    await h.machine.start();
    const despues = h.machine.getSnapshot();
    expect(despues).not.toBe(antes);
    expect(despues).toEqual({ state: { kind: "idle" }, notice: "unavailable" });
  });

  test("showNotice muestra un aviso sin cambiar el estado (p. ej. «No se entendió»)", async () => {
    const h = harness();
    h.machine.showNotice("not-understood");
    expect(h.machine.getNotice()).toBe("not-understood");
    expect(h.machine.getState().kind).toBe("idle");
  });
});
