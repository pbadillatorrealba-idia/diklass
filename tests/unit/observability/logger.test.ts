import { describe, expect, test } from "bun:test";
import { redactLogContext } from "@/lib/observability/logger";

describe("structured logging", () => {
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
});
