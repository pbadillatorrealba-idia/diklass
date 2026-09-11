import { describe, expect, test } from "bun:test";
import {
  corsHeaders,
  handleClientErrorReport,
  MAX_BODY_BYTES,
} from "../../../supabase/functions/report-client-error/handler";

const FUNCTION_URL = "http://localhost:54321/functions/v1/report-client-error";

function harness(consume: (bucketKey: string) => Promise<boolean> = async () => true) {
  const lines: string[] = [];
  const keys: string[] = [];
  return {
    lines,
    keys,
    deps: {
      log: (line: string) => {
        lines.push(line);
      },
      randomId: () => "generated-id",
      consumeQuota: async (bucketKey: string) => {
        keys.push(bucketKey);
        return consume(bucketKey);
      },
    },
  };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(FUNCTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const validReport = { operation: "sign_in", requestId: "req-1", error: { name: "TypeError" } };

describe("report-client-error handler (review #4, finding 13)", () => {
  test("answers the CORS preflight a browser sends before invoking", async () => {
    const { deps, lines } = harness();
    const response = await handleClientErrorReport(
      new Request(FUNCTION_URL, { method: "OPTIONS" }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toContain("x-request-id");
    expect(lines).toEqual([]);
  });

  test("accepts a valid report with CORS headers and logs identifiers only", async () => {
    const { deps, lines } = harness();
    const response = await handleClientErrorReport(
      post(
        { ...validReport, error: { name: "TypeError", message: "Luna, 12 kg" } },
        { "x-request-id": "req-header" },
      ),
      deps,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      corsHeaders["Access-Control-Allow-Origin"],
    );
    expect(await response.json()).toEqual({ accepted: true, requestId: "req-header" });
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      event: "client_error",
      requestId: "req-header",
      operation: "sign_in",
      error: { name: "TypeError" },
    });
    expect(lines[0]).not.toContain("Luna");
  });

  test("rejects methods other than POST", async () => {
    const { deps, lines, keys } = harness();
    const response = await handleClientErrorReport(
      new Request(FUNCTION_URL, { method: "GET" }),
      deps,
    );
    expect(response.status).toBe(405);
    expect(lines).toEqual([]);
    expect(keys).toEqual([]);
  });

  test("rejects malformed JSON and payloads outside the schema", async () => {
    const { deps, lines } = harness();
    expect((await handleClientErrorReport(post("{not json"), deps)).status).toBe(400);
    expect((await handleClientErrorReport(post({ operation: "sign_in" }), deps)).status).toBe(400);
    expect(
      (await handleClientErrorReport(post({ ...validReport, operation: "drop table; --" }), deps))
        .status,
    ).toBe(400);
    expect(lines).toEqual([]);
  });

  test("rejects an oversized body before parsing it", async () => {
    const { deps, lines } = harness();
    const response = await handleClientErrorReport(post("x".repeat(MAX_BODY_BYTES + 1)), deps);
    expect(response.status).toBe(413);
    expect(lines).toEqual([]);
  });

  test("rejects a body over the byte cap even when its character length is under it", async () => {
    // "á" is 1 UTF-16 code unit (.length counts it as 1) but 2 UTF-8 bytes. A cap measured in
    // .length would let this through; the cap must measure encoded bytes instead.
    const body = "á".repeat(MAX_BODY_BYTES / 2 + 1);
    expect(body.length).toBeLessThan(MAX_BODY_BYTES);
    const { deps, lines } = harness();
    const response = await handleClientErrorReport(post(body), deps);
    expect(response.status).toBe(413);
    expect(lines).toEqual([]);
  });

  test("replaces an unsafe request id with a generated one", async () => {
    const { deps } = harness();
    const response = await handleClientErrorReport(
      post(
        { ...validReport, requestId: "bad id with spaces" },
        { "x-request-id": "a".repeat(500) },
      ),
      deps,
    );
    expect(await response.json()).toEqual({ accepted: true, requestId: "generated-id" });
  });

  test("refuses a caller over the quota with 429 and CORS headers", async () => {
    const { deps, lines } = harness(async () => false);
    const response = await handleClientErrorReport(
      post(validReport, { "x-forwarded-for": "198.51.100.7" }),
      deps,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(lines).toEqual([]);
  });

  test("keys the quota by the caller's forwarded IP", async () => {
    const { deps, keys } = harness();
    await handleClientErrorReport(
      post(validReport, { "x-forwarded-for": "198.51.100.7, 10.0.0.1" }),
      deps,
    );
    expect(keys).toEqual(["ip:198.51.100.7"]);
  });

  test("skips the quota entirely -- rather than sharing one bucket -- when no IP is forwarded", async () => {
    const { deps, keys } = harness();
    const response = await handleClientErrorReport(post(validReport), deps);
    expect(response.status).toBe(200);
    expect(keys).toEqual([]);
  });

  test("fails open when the quota store is unavailable", async () => {
    const { deps } = harness(async () => {
      throw new Error("database unavailable");
    });
    const response = await handleClientErrorReport(
      post(validReport, { "x-forwarded-for": "198.51.100.7" }),
      deps,
    );
    expect(response.status).toBe(200);
  });

  test("a preflight never consumes quota", async () => {
    const { deps, keys } = harness();
    await handleClientErrorReport(new Request(FUNCTION_URL, { method: "OPTIONS" }), deps);
    expect(keys).toEqual([]);
  });
});
