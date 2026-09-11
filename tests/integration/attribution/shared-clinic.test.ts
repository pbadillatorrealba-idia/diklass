import { describe, expect, test } from "bun:test";
import { assertNoClientAttributionFields } from "@/lib/attribution/guards";

describe("shared clinic attribution contract", () => {
  test("mutations cannot accept an actor different from the authenticated context", () => {
    expect(() =>
      assertNoClientAttributionFields({ note: "consulta", actorId: "vet-ana" }),
    ).toThrow();
  });
});
