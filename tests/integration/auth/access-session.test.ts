import { describe, expect, test } from "bun:test";
import {
  revokeAccessSession,
  startAccessSession,
  touchAccessSession,
} from "@/features/auth/access-session-service";

describe("access session RPC contract", () => {
  test("starts, touches and revokes only through named server functions", async () => {
    const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
    const client = {
      rpc: async <T>(name: string, args?: Record<string, unknown>) => {
        calls.push({ name, args });
        return { data: (name === "start_access_session" ? "session-1" : true) as T, error: null };
      },
    };

    expect(await startAccessSession(client)).toBe("session-1");
    expect(await touchAccessSession(client, "session-1")).toBe(true);
    expect(await revokeAccessSession(client, "session-1")).toBe(true);
    expect(calls.map(({ name }) => name)).toEqual([
      "start_access_session",
      "touch_access_session",
      "revoke_access_session",
    ]);
    expect(calls[1]?.args).toEqual({ p_session_id: "session-1" });
  });
});
