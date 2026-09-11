import { beforeAll, describe, expect, test } from "bun:test";
import { assertNoClientAttributionFields } from "@/lib/attribution/guards";
import {
  ANA,
  BRUNO,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

describe("shared clinic attribution contract", () => {
  test("mutations cannot accept an actor different from the authenticated context", () => {
    expect(() =>
      assertNoClientAttributionFields({ note: "consulta", created_by: "vet-ana" }),
    ).toThrow();
  });
});

describe.skipIf(!isLiveSupabase)("two authenticated veterinarians against local Supabase", () => {
  let ana: LiveVeterinarian;
  let bruno: LiveVeterinarian;
  let recordId: string;

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    bruno = await signedInVeterinarian(BRUNO);

    const { data, error } = await ana.client
      .from("clinical_records")
      .insert({
        clinic_id: ana.clinicId,
        record_type: "patient",
        content: { name: "Luna integración" },
        status: "draft",
      })
      .select("id, created_by")
      .single();
    if (error) {
      throw error;
    }
    expect(data.created_by).toBe(ana.userId);
    recordId = data.id;
  });

  test("a colleague sees a patient registered by someone else (SC-044, FR-066)", async () => {
    const { data } = await bruno.client
      .from("clinical_records")
      .select("created_by")
      .eq("id", recordId)
      .single();
    expect(data?.created_by).toBe(ana.userId);
  });

  test("an action cannot be registered in another professional's name (SC-042)", async () => {
    const asAna = await bruno.client.from("clinical_records").insert({
      clinic_id: bruno.clinicId,
      record_type: "patient",
      content: {},
      status: "draft",
      created_by: ana.userId,
    });
    expect(asAna.error?.code).toBe("42501");

    const approvedByAna = await bruno.client.from("clinical_records").insert({
      clinic_id: bruno.clinicId,
      record_type: "epicrisis",
      content: {},
      status: "draft",
      approved_by: ana.userId,
      approved_at: new Date().toISOString(),
    });
    expect(approvedByAna.error?.code).toBe("42501");
  });

  test("a colleague attends the shared record without taking over its authorship", async () => {
    const update = await bruno.client
      .from("clinical_records")
      .update({ content: { name: "Luna integración", weightKg: 12 } })
      .eq("id", recordId)
      .select("created_by, updated_by")
      .single();
    expect(update.error).toBeNull();
    expect(update.data).toEqual({ created_by: ana.userId, updated_by: bruno.userId });
  });

  test("the attribution of an existing record cannot be modified (SC-041)", async () => {
    const tamper = await bruno.client
      .from("clinical_records")
      .update({ created_by: bruno.userId })
      .eq("id", recordId);
    expect(tamper.error?.code).toBe("42501");
  });

  test("an attribution can be resolved to the colleague's name (US12/AC2)", async () => {
    const { data } = await bruno.client
      .from("veterinarians")
      .select("display_name")
      .eq("id", ana.userId)
      .single();
    expect(data?.display_name).toBe("Dra. Ana Torres");
  });
});
