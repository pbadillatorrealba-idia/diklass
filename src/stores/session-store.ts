import { create } from "zustand";
import type { AccessSessionState } from "@/features/auth/access-session-service";

type SessionStore = {
  veterinarianId: string | null;
  displayName: string | null;
  accessSessionId: string | null;
  accessState: AccessSessionState;
  setIdentity: (identity: {
    veterinarianId: string;
    displayName: string;
    accessSessionId: string;
  }) => void;
  setAccessState: (accessState: AccessSessionState) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  veterinarianId: null,
  displayName: null,
  accessSessionId: null,
  accessState: "revoked",
  setIdentity: ({ veterinarianId, displayName, accessSessionId }) =>
    set({ veterinarianId, displayName, accessSessionId, accessState: "active" }),
  setAccessState: (accessState) => set({ accessState }),
  clear: () =>
    set({ veterinarianId: null, displayName: null, accessSessionId: null, accessState: "revoked" }),
}));
