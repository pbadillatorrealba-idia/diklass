/**
 * Evalúa el agente con los casos de `tests/fixtures/agente/casos.json` y el modelo real:
 *   AGENT_MODEL=openai:gpt-5.5 OPENAI_API_KEY=... bun scripts/eval-agente.ts
 * Con `PHOENIX_COLLECTOR_ENDPOINT` cada turno queda como traza en Phoenix. Sale con código 1 si algún caso falla.
 */

import { type EvalCase, runCases } from "../supabase/functions/agent/eval";
import { makeModel } from "../supabase/functions/agent/model";
import fixture from "../tests/fixtures/agente/casos.json";

const spec = process.env.AGENT_MODEL ?? "openai:gpt-5.5";
const results = await runCases(fixture.cases as EvalCase[], () => makeModel(spec));
for (const r of results)
  console.log(`${r.pass ? "PASS" : "FAIL"} ${r.id}${r.pass ? "" : `: ${r.failures.join("; ")}`}`);
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} casos OK con ${spec}`);
process.exit(fallos > 0 ? 1 : 0);
