import { afterEach, describe, expect, test } from "bun:test";
import { logEvent, redactLogContext, setLogSink } from "@/lib/observability/logger";

describe("structured logging", () => {
  afterEach(() => setLogSink(null));

  test("redacts secrets and clinical content", () => {
    const result = redactLogContext({
      requestId: "req-1",
      token: "never-log-this",
      clinicalContent: "patient details",
    });

    expect(result).toEqual({
      requestId: "req-1",
      token: "[REDACTED]",
      clinicalContent: "[REDACTED]",
    });
  });

  test("emits a structured line in every build, not only in development", () => {
    const lines: string[] = [];
    setLogSink((line) => lines.push(line));

    logEvent("sign_in_failed", { requestId: "req-9", operation: "sign_in" }, "error");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      event: "sign_in_failed",
      level: "error",
      requestId: "req-9",
      operation: "sign_in",
    });
  });
});
