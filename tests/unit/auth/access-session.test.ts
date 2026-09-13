import { describe, expect, test } from "bun:test";
import {
  ACCESS_SESSION_INACTIVITY_MS,
  type AccessSessionState,
  getAccessSessionState,
} from "@/features/auth/access-session-service";

describe("access session inactivity policy", () => {
  const now = new Date("2026-09-09T12:00:00.000Z");

  test("allows activity up to eight hours after the last activity", () => {
    expect(ACCESS_SESSION_INACTIVITY_MS).toBe(8 * 60 * 60 * 1000);
    expect(
      getAccessSessionState(
        {
          status: "active",
          lastActivityAt: new Date(now.getTime() - ACCESS_SESSION_INACTIVITY_MS + 1_000),
        },
        now,
      ),
    ).toBe("active");
  });

  test("expires at or after eight hours and never revives revoked sessions", () => {
    expect(
      getAccessSessionState(
        {
          status: "active",
          lastActivityAt: new Date(now.getTime() - ACCESS_SESSION_INACTIVITY_MS),
        },
        now,
      ),
    ).toBe("expired");
    expect(getAccessSessionState({ status: "revoked", lastActivityAt: now }, now)).toBe("revoked");
  });

  test("keeps explicit states typed", () => {
    const states: AccessSessionState[] = ["active", "expired", "revoked"];
    expect(states).toHaveLength(3);
  });
});
