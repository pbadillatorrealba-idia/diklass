import { describe, expect, test } from "bun:test";
import { createActivityTracker } from "@/features/auth/activity-tracker";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function setup() {
  let now = 0;
  const touches: number[] = [];
  let expiredCalls = 0;
  const tracker = createActivityTracker({
    now: () => now,
    touch: async () => {
      touches.push(now);
      return true;
    },
    onExpired: () => {
      expiredCalls += 1;
    },
    debounceMs: MINUTE,
    inactivityMs: 8 * HOUR,
  });
  return {
    tracker,
    touches,
    advance: (ms: number) => {
      now += ms;
    },
    expiredCalls: () => expiredCalls,
  };
}

describe("activity tracker (FR-061, FR-067)", () => {
  test("periodic ticks alone never refresh the server-side session", async () => {
    const { tracker, touches, advance } = setup();
    for (let minute = 0; minute < 120; minute += 1) {
      advance(MINUTE);
      await tracker.tick();
    }
    // A timer-driven touch would keep last_activity_at fresh forever, so the
    // database-side eight-hour window could never expire while the app is open.
    expect(touches).toEqual([]);
  });

  test("real interaction touches the server at most once per debounce window", async () => {
    const { tracker, touches, advance } = setup();
    await tracker.registerActivity();
    advance(10_000);
    await tracker.registerActivity();
    advance(MINUTE);
    await tracker.registerActivity();
    expect(touches).toEqual([0, 70_000]);
  });

  test("expires locally after eight hours without interaction", async () => {
    const { tracker, advance, expiredCalls, touches } = setup();
    await tracker.registerActivity();
    advance(8 * HOUR);
    await tracker.tick();
    expect(expiredCalls()).toBe(1);
    expect(touches).toEqual([0]);
  });

  test("an interaction after expiry does not revive the session", async () => {
    const { tracker, advance, touches, expiredCalls } = setup();
    advance(8 * HOUR);
    await tracker.registerActivity();
    expect(expiredCalls()).toBe(1);
    expect(touches).toEqual([]);
  });

  test("expires when the server reports the session is no longer active", async () => {
    let expired = 0;
    const tracker = createActivityTracker({
      now: () => 0,
      touch: async () => false,
      onExpired: () => {
        expired += 1;
      },
      debounceMs: MINUTE,
      inactivityMs: 8 * HOUR,
    });
    await tracker.registerActivity();
    expect(expired).toBe(1);
  });
});
