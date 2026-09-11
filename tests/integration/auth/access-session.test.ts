import { describe, expect, test } from "bun:test";
import {
  ANA,
  adminClient,
  clientWithToken,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

async function expectClinicalAccessDenied(vet: LiveVeterinarian, client = vet.client) {
  const touched = await client.rpc("touch_access_session", { p_session_id: vet.accessSessionId });
  expect(touched.data).toBe(false);

  const read = await client.from("clinical_records").select("id");
  expect(read.data).toEqual([]);

  const write = await client
    .from("clinical_records")
    .insert({ clinic_id: vet.clinicId, record_type: "patient", content: {}, status: "draft" });
  expect(write.error?.code).toBe("42501");
}

describe.skipIf(!isLiveSupabase)("access session lifecycle against local Supabase", () => {
  test("an active session reads the shared clinic and can be refreshed (FR-059)", async () => {
    const ana = await signedInVeterinarian(ANA);

    const read = await ana.client.from("clinical_records").select("id").limit(1);
    expect(read.error).toBeNull();

    const touched = await ana.client.rpc("touch_access_session", {
      p_session_id: ana.accessSessionId,
    });
    expect(touched.data).toBe(true);
  });

  test("after logout the previous token is denied clinical access (FR-061, SC-039)", async () => {
    const ana = await signedInVeterinarian(ANA);

    await ana.client.rpc("revoke_access_sessions");
    await ana.client.auth.signOut();

    // The JWT is still cryptographically valid; only the revoked access session stops it.
    await expectClinicalAccessDenied(ana, clientWithToken(ana.accessToken));
  });

  test("more than eight hours idle expires the session server-side (FR-061)", async () => {
    const ana = await signedInVeterinarian(ANA);

    const { error } = await adminClient()
      .from("access_sessions")
      .update({ last_activity_at: hoursAgo(9), expires_at: hoursAgo(1) })
      .eq("id", ana.accessSessionId);
    expect(error).toBeNull();

    await expectClinicalAccessDenied(ana);
  });
});
