import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import {
  ACCESS_SESSION_INACTIVITY_MS,
  type AccessSessionRpcClient,
  touchAccessSession,
} from "@/features/auth/access-session-service";
import { useSessionStore } from "@/stores/session-store";

type SessionActivityOptions = {
  client: AccessSessionRpcClient;
  sessionId: string | null;
  onExpired: () => void;
};

const TOUCH_DEBOUNCE_MS = 60_000;

export function useSessionActivity({ client, sessionId, onExpired }: SessionActivityOptions) {
  const lastActivityRef = useRef(Date.now());
  const setAccessState = useSessionStore((state) => state.setAccessState);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let disposed = false;
    let lastTouchedAt = 0;
    const expire = () => {
      if (disposed) {
        return;
      }
      setAccessState("expired");
      onExpired();
    };
    const checkAndTouch = async () => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= ACCESS_SESSION_INACTIVITY_MS) {
        expire();
        return;
      }
      if (Date.now() - lastTouchedAt < TOUCH_DEBOUNCE_MS) {
        return;
      }

      lastTouchedAt = Date.now();
      const isActive = await touchAccessSession(client, sessionId);
      if (!isActive) {
        expire();
      }
    };
    const registerActivity = () => {
      lastActivityRef.current = Date.now();
      void checkAndTouch();
    };
    const interval = setInterval(() => void checkAndTouch(), TOUCH_DEBOUNCE_MS);
    const appStateSubscription =
      Platform.OS === "web" ? null : AppState.addEventListener("change", registerActivity);

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.addEventListener("pointerdown", registerActivity);
      window.addEventListener("keydown", registerActivity);
    }

    return () => {
      disposed = true;
      clearInterval(interval);
      appStateSubscription?.remove();
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.removeEventListener("pointerdown", registerActivity);
        window.removeEventListener("keydown", registerActivity);
      }
    };
  }, [client, onExpired, sessionId, setAccessState]);
}
