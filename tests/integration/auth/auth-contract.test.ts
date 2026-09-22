import { describe, expect, test } from "bun:test";
import { type AuthClient, signInWithPassword, signOut } from "@/features/auth/auth-service";

function makeClient(overrides: Partial<AuthClient["auth"]> = {}): AuthClient {
  return {
    auth: {
      signInWithPassword: async () => ({
        data: { user: { id: "vet-ana", email: "vet.ana@example.test" }, session: {} },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      ...overrides,
    },
    rpc: async <T>(functionName: string) => ({
      data: { id: "access-session-1", expiresAt: "2026-09-09T20:00:00.000Z" } as T,
      error: functionName === "start_access_session" ? null : null,
    }),
  };
}

describe("auth contract", () => {
  test("signs in a provisioned account and starts an access session", async () => {
    const client = makeClient();
    const result = await signInWithPassword(client, {
      email: "vet.ana@example.test",
      password: "synthetic-password",
    });

    expect(result.user.id).toBe("vet-ana");
    expect(result.accessSessionId).toBe("access-session-1");
    expect("signUp" in client.auth).toBe(false);
  });

  test("returns one public error for wrong password and unknown account", async () => {
    const wrongPassword = makeClient({
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: { status: 400, message: "Invalid login credentials" },
      }),
    });
    const unknownAccount = makeClient({
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: { status: 400, code: "user_not_found" },
      }),
    });

    await expect(
      signInWithPassword(wrongPassword, { email: "a@test.example", password: "x" }),
    ).rejects.toMatchObject({ normalized: { code: "AUTHENTICATION_FAILED" } });
    await expect(
      signInWithPassword(unknownAccount, { email: "b@test.example", password: "x" }),
    ).rejects.toMatchObject({ normalized: { code: "AUTHENTICATION_FAILED" } });
  });

  test("logout ends only this device's session and is safe to call repeatedly (D1)", async () => {
    const scopes: unknown[] = [];
    const rpcCalls: string[] = [];
    const client = makeClient({
      signOut: async (options) => {
        scopes.push(options?.scope);
        return { error: null };
      },
    });
    const clientWithTrace = {
      ...client,
      rpc: async <T>(name: string) => {
        rpcCalls.push(name);
        return { data: true as T, error: null };
      },
    };

    await signOut(clientWithTrace);
    await signOut(clientWithTrace);
    expect(scopes).toEqual(["local", "local"]);
    expect(rpcCalls).toEqual(["revoke_current_access_session", "revoke_current_access_session"]);
  });
});
