export type ActivityTrackerOptions = {
  now?: () => number;
  /** Refreshes the server-side access session; resolves false when it is no longer active. */
  touch: () => Promise<boolean>;
  onExpired: () => void;
  debounceMs: number;
  inactivityMs: number;
};

export type ActivityTracker = {
  /** Call on real user interaction only. */
  registerActivity: () => Promise<void>;
  /** Call periodically; only re-checks local expiry, never touches the server. */
  tick: () => Promise<void>;
};

/**
 * Tracks real interaction for the access session. Only an interaction may touch the
 * server: a timer that touched it would keep `last_activity_at` fresh forever, so the
 * database-side inactivity window of FR-061 could never expire while the app is open.
 */
export function createActivityTracker({
  now = Date.now,
  touch,
  onExpired,
  debounceMs,
  inactivityMs,
}: ActivityTrackerOptions): ActivityTracker {
  let lastActivityAt = now();
  let lastTouchedAt: number | null = null;
  let expired = false;

  const expire = () => {
    if (expired) {
      return;
    }
    expired = true;
    onExpired();
  };
  const isIdle = () => now() - lastActivityAt >= inactivityMs;

  return {
    async tick() {
      if (!expired && isIdle()) {
        expire();
      }
    },
    async registerActivity() {
      if (expired) {
        return;
      }
      if (isIdle()) {
        expire();
        return;
      }

      lastActivityAt = now();
      if (lastTouchedAt !== null && lastActivityAt - lastTouchedAt < debounceMs) {
        return;
      }

      lastTouchedAt = lastActivityAt;
      if (!(await touch())) {
        expire();
      }
    },
  };
}
