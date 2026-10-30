import { describe, expect, test } from "bun:test";
import {
  type ConsultaDeHoy,
  ordenarConsultasDeHoy,
  resumenDelDia,
} from "@/features/agenda/consultas-de-hoy";

const consulta = (id: string, status: "open" | "closed", createdAt: string): ConsultaDeHoy => ({
  id,
  patientId: `p-${id}`,
  patientName: id,
  createdAt,
  status,
});

describe("consultas de hoy", () => {
  test("las abiertas van primero y cada grupo, por hora", () => {
    const orden = ordenarConsultasDeHoy([
      consulta("a", "closed", "2026-10-27T09:00:00Z"),
      consulta("b", "open", "2026-10-27T12:00:00Z"),
      consulta("c", "open", "2026-10-27T10:00:00Z"),
    ]).map(({ id }) => id);
    expect(orden).toEqual(["c", "b", "a"]);
  });

  test("el resumen cuenta y concuerda en número", () => {
    expect(resumenDelDia([])).toBe("Aún no hay consultas hoy");
    expect(resumenDelDia([consulta("a", "open", "2026-10-27T09:00:00Z")])).toBe(
      "1 consulta: 1 abierta",
    );
    expect(
      resumenDelDia([
        consulta("a", "open", "2026-10-27T09:00:00Z"),
        consulta("b", "closed", "2026-10-27T10:00:00Z"),
        consulta("c", "closed", "2026-10-27T11:00:00Z"),
      ]),
    ).toBe("3 consultas: 1 abierta y 2 cerradas");
  });
});
