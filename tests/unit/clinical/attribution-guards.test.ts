import { describe, expect, test } from "bun:test";
import { AttributionInputError, assertNoClientAttributionFields } from "@/lib/attribution/guards";

describe("clinical attribution input", () => {
  test("rejects actor and timestamp fields sent by a client", () => {
    expect(() =>
      assertNoClientAttributionFields({ name: "Paciente", actorId: "another-vet" }),
    ).toThrow(AttributionInputError);
    expect(() =>
      assertNoClientAttributionFields({ name: "Paciente", createdAt: new Date() }),
    ).toThrow("servidor");
  });

  test("allows domain fields without attribution controls", () => {
    expect(() =>
      assertNoClientAttributionFields({ name: "Paciente", species: "canino" }),
    ).not.toThrow();
  });
});
