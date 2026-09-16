import { afterEach, describe, expect, test } from "bun:test";
import {
  captureClientError,
  type ErrorReporterClient,
  reportClientError,
} from "@/lib/observability/client-error-reporter";
import { setLogSink } from "@/lib/observability/logger";

type Invocation = { name: string; body: Record<string, unknown>; headers?: Record<string, string> };

function recordingClient(result: { error: { message: string } | null }) {
  const calls: Invocation[] = [];
  const client: ErrorReporterClient = {
    functions: {
      invoke: async (name, options) => {
        calls.push({ name, ...options });
        return result;
      },
    },
  };
  return { calls, client };
}

describe("client error reporting (Constitution IV)", () => {
  afterEach(() => setLogSink(null));

  test("forwards the failure to the central function under the same request id", async () => {
    const { calls, client } = recordingClient({ error: null });
    await reportClientError(client, {
      error: new TypeError("Luna presenta ansiedad por separación"),
      operation: "sign_in",
      requestId: "req-42",
    });

    expect(calls[0]?.name).toBe("report-client-error");
    expect(calls[0]?.headers).toEqual({ "x-request-id": "req-42" });
    expect(JSON.stringify(calls[0]?.body)).not.toContain("ansiedad");
  });

  test("a failed report is logged rather than thrown or swallowed", async () => {
    const lines: string[] = [];
    setLogSink((line) => lines.push(line));
    const { client } = recordingClient({ error: { message: "offline" } });

    await expect(
      captureClientError(client, {
        error: new Error("boom"),
        operation: "touch",
        requestId: "req-7",
      }),
    ).resolves.toBeUndefined();

    const events = lines.map((line) => JSON.parse(line) as { event: string; requestId: string });
    expect(events.map(({ event }) => event)).toEqual([
      "client_error",
      "client_error_report_failed",
    ]);
    expect(events.every(({ requestId }) => requestId === "req-7")).toBe(true);
  });
});
