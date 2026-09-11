import { afterAll, describe, expect, test } from "bun:test";
import { adminClient, anonymousClient, isLiveSupabase } from "../live-supabase";

// supabase/config.toml keeps enable_signup = true because this CLI version maps it to
// password login as well. The "sin autoregistro" assumption therefore has to be enforced
// by the database, and this suite is the check that it is.
describe.skipIf(!isLiveSupabase)("self-registered accounts (spec Assumptions, FR-062)", () => {
  let createdUserId: string | undefined;

  afterAll(async () => {
    if (createdUserId) {
      await adminClient().auth.admin.deleteUser(createdUserId);
    }
  });

  test("an account created through Supabase Auth signUp cannot operate", async () => {
    const client = anonymousClient();
    const { data, error } = await client.auth.signUp({
      email: `self.registered.${Date.now()}@example.test`,
      password: "self-registered-password",
    });
    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    createdUserId = data.user?.id;

    const start = await client.rpc("start_access_session");
    expect(start.error?.message).toContain("AUTHENTICATION_REQUIRED");

    expect((await client.from("clinical_records").select("id")).data).toEqual([]);
    expect((await client.from("veterinarians").select("id")).data).toEqual([]);

    const write = await client.from("clinical_records").insert({
      clinic_id: "00000000-0000-0000-0000-000000000001",
      record_type: "patient",
      content: {},
      status: "draft",
    });
    expect(write.error?.code).toBe("42501");
  });
});
