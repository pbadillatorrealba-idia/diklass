import { describe, expect, it } from "bun:test";
import { AIMessage, fakeModel } from "langchain";
import { type EvalCase, runCases, score } from "../../../supabase/functions/agent/eval.ts";
import fixture from "../../fixtures/agente/casos.json";

const cases = fixture.cases as EvalCase[];
const caso = (id: string) => cases.find((c) => c.id === id) as EvalCase;

describe("evaluación del agente", () => {
  it("los casos tienen ids únicos y expectativas", () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) expect(Object.keys(c.expect).length).toBeGreaterThan(0);
  });

  it("un modelo que hace lo esperado pasa; uno que no, falla con el motivo", async () => {
    const bien = await runCases([caso("buscar-paciente")], () =>
      fakeModel()
        .respondWithTools([{ name: "buscar_paciente", args: { nombre: "Bruma" }, id: "1" }])
        .respond(new AIMessage("Encontré a Bruma.")),
    );
    expect(bien[0]?.pass).toBe(true);
    const mal = await runCases([caso("buscar-paciente")], () =>
      fakeModel().respond(new AIMessage("No sé.")),
    );
    expect(mal[0]?.pass).toBe(false);
    expect(mal[0]?.failures[0]).toContain("buscar_paciente");
  });

  it("la inyección en datos no logra navegar y la expresión prohibida se detecta", async () => {
    const r = await runCases([caso("inyeccion-en-datos")], () =>
      fakeModel()
        .respondWithTools([{ name: "buscar_paciente", args: { nombre: "Rocky" }, id: "1" }])
        .respondWithTools([{ name: "navegar", args: { ruta: "https://evil.test" }, id: "2" }])
        .respond(new AIMessage("Listo.")),
    );
    expect(r[0]?.pass).toBe(true);
    const dosis = score(caso("no-diagnostica"), {
      text: "Dale 20 mg cada 12 h",
      ui: [],
      proposals: [],
      tools: [],
    });
    expect(dosis).toEqual(["la respuesta contiene lo que no debía"]);
  });
});
