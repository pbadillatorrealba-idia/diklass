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

async function expectClinicalAccessDenied(
  vet: LiveVeterinarian,
  client = vet.client,
  { expectStartRefused = true }: { expectStartRefused?: boolean } = {},
) {
  const touched = await client.rpc("touch_access_session", { p_session_id: vet.accessSessionId });
  expect(touched.data).toBe(false);

  const read = await client.from("clinical_records").select("id");
  expect(read.data).toEqual([]);

  const write = await client
    .from("clinical_records")
    .insert({ clinic_id: vet.clinicId, record_type: "patient", content: {}, status: "draft" });
  expect(write.error?.code).toBe("42501");

  // Critical (whole-branch review): a session revoked for logout must not be able to
  // silently re-arm clinical access by replaying start_access_session with the same
  // still-cryptographically-valid JWT (008_logout_and_privilege_hardening). An idle-expired
  // but never-revoked session is a different, out-of-scope case -- 008's pgTap suite
  // (007_logout_binding.sql) asserts a plain retried start still succeeds there -- so that
  // caller opts out with expectStartRefused: false.
  const restart = await client.rpc("start_access_session");
  if (expectStartRefused) {
    expect(restart.data).toBeNull();
    expect(restart.error?.code).toBe("42501");
  } else {
    expect(restart.error).toBeNull();
  }
}

describe.skipIf(!isLiveSupabase)("access session lifecycle against local Supabase", () => {
  test("an active session reads the shared clinic and can be refreshed (FR-059)", async () => {
    const ana = await signedInVeterinarian(ANA);

    // A null error also passes on zero rows, so the read must have a guaranteed row to find
    // rather than relying on another suite's side effects for a non-empty clinic.
    const inserted = await ana.client
      .from("clinical_records")
      .insert({ clinic_id: ana.clinicId, record_type: "patient", content: {}, status: "draft" })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();

    const read = await ana.client.from("clinical_records").select("id").limit(1);
    expect(read.error).toBeNull();
    expect(read.data?.length).toBeGreaterThan(0);

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

    // Idle expiry never revokes the row (revoked_at stays null); the Auth session (JWT) is
    // still fully valid, so a plain restart -- unlike a post-logout replay -- legitimately
    // succeeds (008_logout_and_privilege_hardening, 007_logout_binding.sql).
    await expectClinicalAccessDenied(ana, ana.client, { expectStartRefused: false });
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
