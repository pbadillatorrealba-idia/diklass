import { describe, expect, it } from "bun:test";
import { handleAgent } from "../../../supabase/functions/agent/handler.ts";

const deps = (over: Record<string, unknown> = {}) => {
  const logs: string[] = [];
  return {
    logs,
    d: {
      log: (l: string) => logs.push(l),
      randomId: () => "rid",
      canUse: async () => true,
      run: async () => ({ text: "hola", ui: [], proposals: [] }),
      ...over,
    },
  };
};
const post = (body: unknown, auth: string | null = "Bearer x") =>
  new Request("http://x/agent", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify(body),
  });

describe("handler del agente", () => {
  it("sin Authorization, 401", async () => {
    const { d } = deps();
    expect((await handleAgent(post({ text: "a" }, null), d)).status).toBe(401);
  });
  it("sin acceso activo o con error al comprobar, 403 y no llama al modelo", async () => {
    let called = false;
    const run = async () => {
      called = true;
      return { text: "", ui: [], proposals: [] };
    };
    const a = deps({ canUse: async () => false, run });
    expect((await handleAgent(post({ text: "a" }), a.d)).status).toBe(403);
    const b = deps({
      canUse: async () => {
        throw new Error("x");
      },
      run,
    });
    expect((await handleAgent(post({ text: "a" }), b.d)).status).toBe(403);
    expect(called).toBe(false);
  });
  it("cuerpo inválido, 400", async () => {
    const { d } = deps();
    expect((await handleAgent(post({ text: "" }), d)).status).toBe(400);
    expect((await handleAgent(post({ text: "a", patientId: "no-uuid" }), d)).status).toBe(400);
  });
  it("ok devuelve texto y no registra el texto del usuario", async () => {
    const { d, logs } = deps();
    const res = await handleAgent(post({ text: "dato clínico secreto" }), d);
    expect(res.status).toBe(200);
    expect((await res.json()).text).toBe("hola");
    expect(logs.join()).not.toContain("secreto");
  });
  it("fallo del modelo, 502 sin filtrar el mensaje", async () => {
    const { d, logs } = deps({
      run: async () => {
        throw new Error("sk-SECRETO");
      },
    });
    expect((await handleAgent(post({ text: "a" }), d)).status).toBe(502);
    expect(logs.join()).not.toContain("SECRETO");
  });
});

describe("since del agente", () => {
  const { sinceValido } = require("../../../supabase/functions/agent/handler.ts");
  const ahora = Date.parse("2026-10-29T15:00:00Z");
  it("acepta hoy, ignora lo muy antiguo, el futuro y lo ausente", () => {
    expect(sinceValido("2026-10-29T03:00:00.000Z", ahora)).toBe("2026-10-29T03:00:00.000Z");
    expect(sinceValido("1970-01-01T00:00:00.000Z", ahora)).toBeUndefined();
    expect(sinceValido("2026-11-30T00:00:00.000Z", ahora)).toBeUndefined();
    expect(sinceValido(undefined, ahora)).toBeUndefined();
  });
});
