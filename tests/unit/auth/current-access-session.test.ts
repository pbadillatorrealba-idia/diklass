import { describe, expect, test } from "bun:test";
import {
  type AccessSessionRpcClient,
  getCurrentAccessSession,
} from "@/features/auth/access-session-service";

function rpcReturning(data: unknown, error: { message: string } | null = null) {
  const calls: string[] = [];
  const client: AccessSessionRpcClient = {
    rpc: async <T>(functionName: string) => {
      calls.push(functionName);
      return { data: data as T | null, error };
    },
  };
  return { client, calls };
}

describe("getCurrentAccessSession (review #4, finding 5)", () => {
  test("resumes the access session bound to the current Auth session", async () => {
    const { client, calls } = rpcReturning({
      id: "session-1",
      expiresAt: "2026-09-11T20:00:00.000Z",
    });
    expect(await getCurrentAccessSession(client)).toEqual({
      id: "session-1",
      expiresAt: "2026-09-11T20:00:00.000Z",
    });
    expect(calls).toEqual(["current_access_session"]);
  });

  test("returns null when this Auth session has no live access session", async () => {
    const { client } = rpcReturning(null);
    expect(await getCurrentAccessSession(client)).toBeNull();
  });

  test("returns null for a malformed payload instead of trusting it", async () => {
    const { client } = rpcReturning({ id: 42 });
    expect(await getCurrentAccessSession(client)).toBeNull();
  });

  test("surfaces an RPC failure", async () => {
    const { client } = rpcReturning(null, { message: "network down" });
    await expect(getCurrentAccessSession(client)).rejects.toThrow("network down");
  });
});
