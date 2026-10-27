import { describe, expect, test } from "bun:test";
import { createTurnGate } from "@/features/asistente/turn-gate";

// Un solo turno a la vez, compartido entre las instancias del controlador (panel y /knowledge).
describe("createTurnGate", () => {
  test("acepta un turno y rechaza otro mientras haya uno en curso", () => {
    const gate = createTurnGate();
    const turno = gate.begin();
    expect(turno).not.toBeNull();
    expect(gate.begin()).toBeNull();
    turno?.end();
    expect(gate.begin()).not.toBeNull();
  });

  test("«Detener» aborta la señal del turno en curso", () => {
    const gate = createTurnGate();
    const turno = gate.begin();
    expect(turno?.signal.aborted).toBe(false);
    gate.abort();
    expect(turno?.signal.aborted).toBe(true);
  });

  test("abortar sin turno no hace nada", () => {
    expect(() => createTurnGate().abort()).not.toThrow();
  });

  test("terminar un turno viejo no libera el de uno nuevo", () => {
    const gate = createTurnGate();
    const viejo = gate.begin();
    gate.abort();
    viejo?.end();
    const nuevo = gate.begin();
    viejo?.end(); // un `end` tardío del anterior
    expect(gate.begin()).toBeNull();
    nuevo?.end();
  });

  test("invalidar (borrar la conversación) deja obsoleto el turno en vuelo", () => {
    const gate = createTurnGate();
    const turno = gate.begin();
    expect(turno?.isCurrent()).toBe(true);
    gate.invalidate();
    expect(turno?.isCurrent()).toBe(false);
    expect(turno?.signal.aborted).toBe(true);
    const siguiente = gate.begin();
    expect(siguiente?.isCurrent()).toBe(true);
  });
});
