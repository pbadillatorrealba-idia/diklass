import { useCallback, useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import {
  ACCESS_SESSION_INACTIVITY_MS,
  type AccessSessionRpcClient,
  touchAccessSession,
} from "@/features/auth/access-session-service";
import { type ActivityTracker, createActivityTracker } from "@/features/auth/activity-tracker";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";

type SessionActivityOptions = {
  client: AccessSessionRpcClient;
  sessionId: string | null;
  onExpired: () => void;
};

const TOUCH_DEBOUNCE_MS = 60_000;
const EXPIRY_CHECK_MS = 60_000;

export function useSessionActivity({ client, sessionId, onExpired }: SessionActivityOptions) {
  const trackerRef = useRef<ActivityTracker | null>(null);
  const setAccessState = useSessionStore((state) => state.setAccessState);

  useEffect(() => {
    if (!sessionId) {
      trackerRef.current = null;
      return;
    }

    const tracker = createActivityTracker({
      touch: async () => {
        const requestId = makeRequestId();
        try {
          return await touchAccessSession(client, sessionId);
        } catch (error) {
          // A network failure is not evidence of expiry; the server stays the authority.
          void captureClientError(errorReporter, {
            error,
            operation: "touch_access_session",
            requestId,
          });
          return true;
        }
      },
      onExpired: () => {
        setAccessState("expired");
        onExpired();
      },
      debounceMs: TOUCH_DEBOUNCE_MS,
      inactivityMs: ACCESS_SESSION_INACTIVITY_MS,
    });
    trackerRef.current = tracker;

    // The timer and a return to the foreground only re-check expiry: neither is an
    // interaction, so neither may refresh the server-side session (FR-061, FR-067).
    const interval = setInterval(() => void tracker.tick(), EXPIRY_CHECK_MS);
    const appState = AppState.addEventListener("change", (status) => {
      if (status === "active") {
        void tracker.tick();
      }
    });
    const register = () => void tracker.registerActivity();
    const hasWindow = Platform.OS === "web" && typeof window !== "undefined";
    if (hasWindow) {
      window.addEventListener("pointerdown", register);
      window.addEventListener("keydown", register);
    }

    return () => {
      clearInterval(interval);
      appState.remove();
      if (hasWindow) {
        window.removeEventListener("pointerdown", register);
        window.removeEventListener("keydown", register);
      }
      trackerRef.current = null;
    };
  }, [client, onExpired, sessionId, setAccessState]);

  // Native has no global input events: the protected layout feeds its root touches here.
  const registerActivity = useCallback(() => {
    void trackerRef.current?.registerActivity();
  }, []);

  return { registerActivity };
}
