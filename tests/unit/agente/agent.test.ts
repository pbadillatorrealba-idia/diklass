import { describe, expect, it } from "bun:test";
import { AIMessage, fakeModel } from "langchain";
import { datos, isAllowedRoute, runAgent } from "../../../supabase/functions/agent/agent.ts";

const db = (rows: unknown[]) => ({ rpc: async () => ({ data: rows, error: null }) });

describe("agente", () => {
  it("usa buscar_paciente y responde con el resultado", async () => {
    const model = fakeModel()
      .respondWithTools([{ name: "buscar_paciente", args: { nombre: "Bruma" }, id: "1" }])
      .respond(new AIMessage("Encontré a Bruma."));
    const r = await runAgent({
      model,
      db: db([{ id: "p1", name: "Bruma", species: "canina", breed: "x", tutor_name: "Ana" }]),
      history: [],
      text: "busca a Bruma",
      patientId: null,
    });
    expect(r.text).toBe("Encontré a Bruma.");
    expect(r.ui).toEqual([]);
  });

  it("navegar emite la acción solo a rutas permitidas", async () => {
    const model = fakeModel()
      .respondWithTools([{ name: "navegar", args: { ruta: "/patients" }, id: "1" }])
      .respondWithTools([{ name: "navegar", args: { ruta: "/admin" }, id: "2" }])
      .respond(new AIMessage("ok"));
    const r = await runAgent({ model, db: db([]), history: [], text: "abre", patientId: null });
    expect(r.ui).toEqual([{ type: "navigate", path: "/patients" }]);
  });

  it("lista blanca de rutas y datos delimitados", () => {
    expect(isAllowedRoute("/patients/123e4567-e89b-42d3-a456-426614174000")).toBe(true);
    expect(isAllowedRoute("/patients/../admin")).toBe(false);
    expect(datos({ a: 1 })).toBe('<datos>{"a":1}</datos>');
  });
});
