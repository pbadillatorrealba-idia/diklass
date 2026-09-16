import { create } from "zustand";
import type { AccessSessionState } from "@/features/auth/access-session-service";

export type SessionIdentity = {
  veterinarianId: string;
  displayName: string;
  clinicId: string;
  accessSessionId: string;
};

type SessionStore = {
  veterinarianId: string | null;
  displayName: string | null;
  clinicId: string | null;
  accessSessionId: string | null;
  accessState: AccessSessionState;
  setIdentity: (identity: SessionIdentity) => void;
  setAccessState: (accessState: AccessSessionState) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionStore>((set) => ({
  veterinarianId: null,
  displayName: null,
  clinicId: null,
  accessSessionId: null,
  accessState: "revoked",
  setIdentity: (identity) => set({ ...identity, accessState: "active" }),
  setAccessState: (accessState) => set({ accessState }),
  clear: () =>
    set({
      veterinarianId: null,
      displayName: null,
      clinicId: null,
      accessSessionId: null,
      accessState: "revoked",
    }),
}));
