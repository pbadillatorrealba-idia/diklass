import { describe, expect, test } from "bun:test";
import { executeProposal, isValidAction } from "@/features/asistente/proposal-action";
import { AgentResponder } from "@/features/asistente/responders";

const base = {
  kind: "anamnesis" as const,
  consultationId: "c1",
  field: "motivo_consulta",
  text: "ladra",
};

/** Cliente falso: la lectura de anamnesis devuelve `rows`; cuenta los INSERT. */
const fake = (rows: unknown[]) => {
  const inserts: unknown[] = [];
  const read: Record<string, unknown> = {};
  const chain: Record<string, unknown> = new Proxy(read, {
    get: (_t, prop) => {
      if (prop === "then") return (ok: (v: unknown) => void) => ok({ data: rows, error: null });
      if (prop === "insert")
        return (p: unknown) => {
          inserts.push(p);
          return chain;
        };
      if (prop === "single" || prop === "maybeSingle")
        return async () => ({
          data: {
            id: "r1",
            created_by: "u",
            created_at: "t",
            updated_at: null,
            updated_by: null,
            supersedes_event_id: null,
          },
          error: null,
        });
      return () => chain;
    },
  });
  return {
    client: { from: () => chain, rpc: async () => ({ data: null, error: null }) } as never,
    inserts,
  };
};

describe("proposal-action", () => {
  test("isValidAction rechaza campos que no existen en el catálogo", () => {
    expect(isValidAction(base)).toBe(true);
    expect(isValidAction({ ...base, field: "inventado" })).toBe(false);
  });

  test("no duplica una entrada idéntica ya registrada", async () => {
    const { client, inserts } = fake([
      {
        id: "e1",
        record_type: "anamnesis",
        content: {
          consultationId: "c1",
          field: "motivo_consulta",
          text: "ladra",
          provenance: "inferida",
        },
      },
    ]);
    const r = await executeProposal(client, "clinic", base);
    expect(r.attribution).toBeNull();
    expect(inserts).toEqual([]);
  });

  test("escribe una vez, como borrador inferido, y devuelve la atribución del servidor", async () => {
    const { client, inserts } = fake([]);
    const r = await executeProposal(client, "clinic", base);
    expect(r.attribution).not.toBeNull();
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      record_type: "anamnesis",
      status: "draft",
      content: { provenance: "inferida" },
    });
  });

  test("el agente descarta propuestas inválidas y emite las válidas como tarjeta", async () => {
    const r = new AgentResponder({
      navigate: () => {},
      invoke: async () => ({
        text: "ok",
        ui: [],
        proposals: [
          { id: "a", summary: "s", origin: "o", action: base },
          { id: "b", summary: "s", origin: "o", action: { ...base, field: "inventado" } },
        ],
      }),
    });
    const out = [];
    for await (const e of r.respond(
      [],
      { text: "x", patientId: null },
      new AbortController().signal,
    ))
      out.push(e);
    const parts = (out[0] as { parts: { type: string }[] }).parts;
    expect(parts.map((p) => p.type)).toEqual(["text", "proposal"]);
  });
});
