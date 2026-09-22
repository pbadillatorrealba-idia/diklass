import { describe, expect, test } from "bun:test";
import { AttributionInputError, assertNoClientAttributionFields } from "@/lib/attribution/guards";

const ATTRIBUTION_COLUMNS = [
  "actor_id",
  "created_by",
  "created_at",
  "updated_by",
  "updated_at",
  "approved_by",
  "approved_at",
];

describe("clinical attribution input (review #4, finding 11)", () => {
  test.each(ATTRIBUTION_COLUMNS)("rejects %s, as a PostgREST payload names it", (column) => {
    expect(() =>
      assertNoClientAttributionFields({ record_type: "patient", [column]: "another-vet" }),
    ).toThrow(AttributionInputError);
  });

  test("names the offending columns", () => {
    try {
      assertNoClientAttributionFields({ record_type: "epicrisis", approved_by: "vet-ana" });
      throw new Error("expected the guard to reject approved_by");
    } catch (error) {
      expect(error).toBeInstanceOf(AttributionInputError);
      expect((error as AttributionInputError).fields).toEqual(["approved_by"]);
    }
  });

  test("allows the domain columns a client must send, clinic_id included", () => {
    expect(() =>
      assertNoClientAttributionFields({
        clinic_id: "00000000-0000-0000-0000-000000000001",
        record_type: "patient",
        content: { name: "Luna" },
        status: "draft",
      }),
    ).not.toThrow();
  });
});
