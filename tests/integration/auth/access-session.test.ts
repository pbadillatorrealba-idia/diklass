import { describe, expect, test } from "bun:test";
import {
  ANA,
  adminClient,
  clientWithToken,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

const hoursAgo = (hours: number, from: number) => new Date(from - hours * 3_600_000).toISOString();

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

    await ana.client.rpc("revoke_current_access_session");
    await ana.client.auth.signOut({ scope: "local" });

    // The JWT is still cryptographically valid; only the revoked access session stops it.
    await expectClinicalAccessDenied(ana, clientWithToken(ana.accessToken));
  });

  test("more than eight hours idle expires the session server-side (FR-061)", async () => {
    const ana = await signedInVeterinarian(ANA);

    // Derive both timestamps from a single instant: the table's check constraint requires
    // expires_at <= last_activity_at + 8h, and two separate Date.now() calls can straddle a
    // millisecond boundary and violate it.
    const now = Date.now();
    const { error } = await adminClient()
      .from("access_sessions")
      .update({ last_activity_at: hoursAgo(9, now), expires_at: hoursAgo(1, now) })
      .eq("id", ana.accessSessionId);
    expect(error).toBeNull();

    await expectClinicalAccessDenied(ana);
  });

  test("two devices hold separate access sessions, and logging out ends only one (D1)", async () => {
    const firstDevice = await signedInVeterinarian(ANA);
    const secondDevice = await signedInVeterinarian(ANA);

    const firstResume = await firstDevice.client.rpc("current_access_session");
    expect((firstResume.data as { id: string } | null)?.id).toBe(firstDevice.accessSessionId);
    const secondResume = await secondDevice.client.rpc("current_access_session");
    expect((secondResume.data as { id: string } | null)?.id).toBe(secondDevice.accessSessionId);

    const revoked = await firstDevice.client.rpc("revoke_current_access_session");
    expect(revoked.error).toBeNull();
    await expectClinicalAccessDenied(firstDevice);

    const stillActive = await secondDevice.client.rpc("touch_access_session", {
      p_session_id: secondDevice.accessSessionId,
    });
    expect(stillActive.data).toBe(true);
  });
});
