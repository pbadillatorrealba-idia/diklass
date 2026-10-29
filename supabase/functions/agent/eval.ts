import { type AgentResult, type Db, runAgent } from "./agent.ts";

/**
 * Evaluación del agente con casos anotados (agente-conversacional · evaluación). Cada caso fija una
 * «base» falsa y lo que debe (y no debe) pasar; `runCases` los ejecuta con el modelo que se le dé y
 * devuelve un veredicto por caso. Con un modelo real mide regresiones al cambiar modelo o prompt; con
 * `fakeModel` solo prueba el marcador.
 */
export type EvalCase = {
  id: string;
  text: string;
  db: {
    patients?: Record<string, unknown>[];
    open?: string[];
    today?: { paciente: string; estado: string }[];
  };
  expect: {
    /** Herramientas que deben haberse usado (en cualquier orden). */
    tools?: string[];
    /** Ruta a la que debe navegar; `null` = no debe navegar. */
    navigate?: string | null;
    /** Número exacto de propuestas. */
    proposals?: number;
    /** La respuesta NO debe coincidir con esta expresión (opcional `(?i)` al inicio). */
    textNotMatches?: string;
  };
};

export type EvalResult = { id: string; pass: boolean; failures: string[]; result?: AgentResult };

const dbOf = (c: EvalCase): Db => ({
  rpc: async () => ({ data: c.db.patients ?? [], error: null }),
  openConsultations: async () => c.db.open ?? [],
  consultationsSince: async () => ({ consultas: c.db.today ?? [], truncado: false }),
});

export function score(c: EvalCase, r: AgentResult): string[] {
  const failures: string[] = [];
  for (const t of c.expect.tools ?? []) {
    if (!r.tools.includes(t)) failures.push(`no usó la herramienta ${t}`);
  }
  if ("navigate" in c.expect) {
    const ruta = r.ui.find((u) => u.type === "navigate")?.path ?? null;
    if (ruta !== c.expect.navigate)
      failures.push(`navegó a ${ruta}, esperaba ${c.expect.navigate}`);
  }
  if (c.expect.proposals !== undefined && r.proposals.length !== c.expect.proposals) {
    failures.push(`${r.proposals.length} propuestas, esperaba ${c.expect.proposals}`);
  }
  if (c.expect.textNotMatches) {
    const raw = c.expect.textNotMatches;
    const re = raw.startsWith("(?i)") ? new RegExp(raw.slice(4), "i") : new RegExp(raw);
    if (re.test(r.text)) failures.push("la respuesta contiene lo que no debía");
  }
  return failures;
}

export async function runCases(
  cases: EvalCase[],
  model: (
    c: EvalCase,
  ) => Parameters<typeof runAgent>[0]["model"] | Promise<Parameters<typeof runAgent>[0]["model"]>,
): Promise<EvalResult[]> {
  const out: EvalResult[] = [];
  for (const c of cases) {
    try {
      const result = await runAgent({
        model: await model(c),
        db: dbOf(c),
        history: [],
        text: c.text,
        patientId: null,
      });
      const failures = score(c, result);
      out.push({ id: c.id, pass: failures.length === 0, failures, result });
    } catch (error) {
      out.push({
        id: c.id,
        pass: false,
        failures: [`error: ${error instanceof Error ? error.name : "Error"}`],
      });
    }
  }
  return out;
}
