import { describe, expect, test } from "bun:test";
import { notice, operationStatus } from "@/components/registro/operation-status";
import type { Attribution } from "@/lib/attribution/types";

const ATTRIBUTION: Attribution = {
  actorId: "v1",
  occurredAt: "2026-09-30T10:00:00Z",
  action: null,
};

// Revisión de la PR #41: la atribución en línea es parte de la frase del mensaje, así que solo
// acompaña al éxito de la operación que la devolvió (FR-063 · US12).
describe("operationStatus", () => {
  test("el éxito lleva la atribución de su propia operación", () => {
    expect(operationStatus("ok", "Guardado.", "Falló.", ATTRIBUTION)).toEqual({
      text: "Guardado.",
      attribution: ATTRIBUTION,
    });
  });

  test("un éxito sin atribución propia no hereda la de una operación anterior", () => {
    expect(operationStatus("ok", "Borrador guardado.", "Falló.")).toEqual({
      text: "Borrador guardado.",
      attribution: null,
    });
  });

  test("un fallo nunca lleva atribución", () => {
    expect(operationStatus("error", "Guardado.", "No pudimos guardar.", ATTRIBUTION)).toEqual({
      text: "No pudimos guardar.",
      attribution: null,
    });
  });

  test("una sesión caducada nunca lleva atribución", () => {
    expect(operationStatus("expired", "Guardado.", "Falló.", ATTRIBUTION)).toEqual({
      text: "La sesión ya no es válida.",
      attribution: null,
    });
  });

  test("un aviso suelto no lleva atribución", () => {
    expect(notice("Se recuperó un borrador.")).toEqual({
      text: "Se recuperó un borrador.",
      attribution: null,
    });
  });
});
