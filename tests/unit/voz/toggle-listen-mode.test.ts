import { describe, expect, test } from "bun:test";
import type { ListenModeState } from "@/features/voz/listen-mode-controller";
import { toggleListenMode } from "@/features/voz/listen-mode-toggle";
import type { ListenModeApi } from "@/features/voz/use-listen-mode";

// Hallazgo 1 de la revisión (PR #29) · FR-025 · US6-AC5: la entrada de UI del botón debe poder
// DETENER en cualquier momento de la captura; jamás queda bloqueada mientras se captura.

function apiFalso(state: ListenModeState, alLlamar: (nombre: string) => void): ListenModeApi {
  return {
    state,
    facts: [],
    segments: [],
    isBusy: false,
    start: () => {
      alLlamar("start");
      return Promise.resolve();
    },
    stop: () => {
      alLlamar("stop");
      return Promise.resolve();
    },
    confirmFact: () => Promise.resolve(),
    discardFact: () => Promise.resolve(),
    editFact: () => Promise.resolve(),
  };
}

describe("toggleListenMode (entrada de UI del botón «Modo de escucha»)", () => {
  test("FR-025 · US6-AC5: con la captura activa detiene, no re-arranca y jamás se bloquea", async () => {
    const llamadas: string[] = [];
    const pendientes: boolean[] = [];
    await toggleListenMode(
      apiFalso("capturando", (nombre) => llamadas.push(nombre)),
      (pending) => pendientes.push(pending),
    );
    expect(llamadas).toEqual(["stop"]);
    expect(pendientes).toEqual([]);
  });

  test("el botón está ocupado solo mientras inicia: vuelve a estar disponible con la captura corriendo", async () => {
    const llamadas: string[] = [];
    const pendientes: boolean[] = [];
    await toggleListenMode(
      apiFalso("inactivo", (nombre) => llamadas.push(nombre)),
      (pending) => pendientes.push(pending),
    );
    expect(llamadas).toEqual(["start"]);
    expect(pendientes).toEqual([true, false]);
  });

  test("todo estado distinto de capturando activa (FR-014 · US6-AC10)", async () => {
    for (const estado of ["inactivo", "detenido", "no_disponible"] as const) {
      const llamadas: string[] = [];
      await toggleListenMode(
        apiFalso(estado, (nombre) => llamadas.push(nombre)),
        () => {},
      );
      expect(llamadas).toEqual(["start"]);
    }
  });
});
