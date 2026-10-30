import { describe, expect, it } from "bun:test";
import { RedactErrors, setupTracing } from "../../../supabase/functions/agent/tracing.ts";

describe("tracing", () => {
  it("sin endpoint no instrumenta nada", () => {
    expect(setupTracing({})).toBeNull();
  });

  it("RedactErrors deja solo el tipo de la excepción y quita el mensaje del estado", () => {
    const span: {
      events: { name: string; attributes?: Record<string, unknown> }[];
      status: Record<string, unknown>;
    } = {
      events: [
        {
          name: "exception",
          attributes: {
            "exception.type": "AuthenticationError",
            "exception.message": "Incorrect API key provided: sk-SECRETO",
            "exception.stacktrace": "at ... sk-SECRETO",
          },
        },
        { name: "otro", attributes: { a: 1 } },
      ],
      status: { code: 2, message: "Incorrect API key provided: sk-SECRETO" },
    };
    new RedactErrors().onEnd(span as never);
    expect(JSON.stringify(span)).not.toContain("SECRETO");
    expect(span.events[0]?.attributes).toEqual({ "exception.type": "AuthenticationError" });
    expect(span.events[1]?.attributes).toEqual({ a: 1 });
    expect(span.status).toEqual({ code: 2 });
  });
});
