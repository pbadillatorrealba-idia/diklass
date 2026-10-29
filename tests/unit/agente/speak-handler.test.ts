import { describe, expect, test } from "bun:test";
import { handleSpeak, MAX_SPEAK_CHARS } from "../../../supabase/functions/speak/handler.ts";

const harness = (over: Record<string, unknown> = {}) => {
  const logs: string[] = [];
  const calls = { synth: 0 };
  return {
    logs,
    calls,
    deps: {
      log: (l: string) => logs.push(l),
      randomId: () => "rid",
      canUse: async () => true,
      consumeQuota: async () => "ok" as const,
      synthesize: async () => {
        calls.synth++;
        return new Uint8Array([1, 2, 3]);
      },
      ...over,
    },
  };
};
const post = (body: unknown, auth: string | null = "Bearer x") =>
  new Request("http://x/speak", {
    method: "POST",
    headers: auth ? { Authorization: auth } : {},
    body: JSON.stringify(body),
  });

describe("speak", () => {
  test("sin sesión 401; sin acceso 403 sin llamar al proveedor", async () => {
    const a = harness();
    expect((await handleSpeak(post({ text: "hola" }, null), a.deps)).status).toBe(401);
    const b = harness({ canUse: async () => false });
    expect((await handleSpeak(post({ text: "hola" }), b.deps)).status).toBe(403);
    expect(b.calls.synth).toBe(0);
  });
  test("texto vacío o demasiado largo, 400", async () => {
    const { deps } = harness();
    expect((await handleSpeak(post({ text: " " }), deps)).status).toBe(400);
    expect((await handleSpeak(post({ text: "a".repeat(MAX_SPEAK_CHARS + 1) }), deps)).status).toBe(
      400,
    );
  });
  test("cuota: consentimiento 403, límite 429, error 503; sin proveedor", async () => {
    for (const [q, status] of [
      ["consent_required", 403],
      ["rate_limited", 429],
      ["unavailable", 503],
    ] as const) {
      const { deps, calls } = harness({ consumeQuota: async () => q });
      expect((await handleSpeak(post({ text: "hola" }), deps)).status).toBe(status);
      expect(calls.synth).toBe(0);
    }
  });
  test("ok devuelve base64 y no registra el texto", async () => {
    const { deps, logs } = harness();
    const res = await handleSpeak(post({ text: "dato clínico secreto" }), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ audio: "AQID", mime: "audio/mpeg" });
    expect(logs.join()).not.toContain("secreto");
  });
  test("fallo del proveedor, 502 sin filtrar el mensaje", async () => {
    const { deps, logs } = harness({
      synthesize: async () => {
        throw new Error("sk-SECRETO");
      },
    });
    expect((await handleSpeak(post({ text: "hola" }), deps)).status).toBe(502);
    expect(logs.join()).not.toContain("SECRETO");
  });
});
