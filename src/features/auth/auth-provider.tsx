import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type AccessSessionRpcClient,
  getCurrentAccessSession,
} from "@/features/auth/access-session-service";
import {
  type AuthClient,
  AuthenticationError,
  signInWithPassword,
  signOut,
} from "@/features/auth/auth-service";
import { AuthErrorCode } from "@/lib/errors";
import type { LoginValues } from "@/lib/forms/form";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { type SessionIdentity, useSessionStore } from "@/stores/session-store";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** A Supabase Auth user *and* a provisioned identity holding an access session. */
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (values: LoginValues) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const accessSessionClient = supabase as unknown as AccessSessionRpcClient;

async function loadIdentity(
  userId: string,
  accessSessionId?: string,
): Promise<SessionIdentity | null> {
  const { data: profile, error } = await supabase
    .from("veterinarians")
    .select("id, display_name, clinic_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!profile) {
    return null;
  }

  // Only the access session bound to *this* Auth session may be resumed: the newest
  // non-revoked row could belong to another device (review #4, finding 5).
  const sessionId = accessSessionId ?? (await getCurrentAccessSession(accessSessionClient))?.id;
  if (!sessionId) {
    return null;
  }

  return {
    veterinarianId: profile.id,
    displayName: profile.display_name,
    clinicId: profile.clinic_id,
    accessSessionId: sessionId,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const veterinarianId = useSessionStore((state) => state.veterinarianId);
  const setIdentity = useSessionStore((state) => state.setIdentity);
  const clear = useSessionStore((state) => state.clear);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    // A reload keeps the Supabase session but loses the in-memory identity. Rebuild it
    // from the server so activity tracking and draft preservation keep working.
    const hydrate = async () => {
      const requestId = makeRequestId();
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        let restored: Session | null = null;
        if (data.session) {
          const identity = await loadIdentity(data.session.user.id);
          if (identity) {
            setIdentity(identity);
            restored = data.session;
          } else {
            // No live access session: the server would deny every clinical operation.
            await supabase.auth.signOut({ scope: "local" });
          }
        }
        if (mounted) {
          setSession(restored);
        }
      } catch (error) {
        void captureClientError(errorReporter, { error, operation: "restore_session", requestId });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    void hydrate();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        clear();
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [clear, setIdentity]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session && veterinarianId),
      isLoading,
      signIn: async (values) => {
        const requestId = makeRequestId();
        try {
          const result = await signInWithPassword(
            supabase as unknown as AuthClient,
            values,
            requestId,
          );
          const identity = await loadIdentity(result.user.id, result.accessSessionId);
          if (!identity) {
            await supabase.auth.signOut({ scope: "local" });
            // Same public error as a wrong password: FR-060 forbids telling an existing but
            // unprovisioned account apart from any other failure.
            throw new AuthenticationError({
              code: AuthErrorCode.AuthenticationFailed,
              publicMessage: "Identificador o contraseña incorrectos.",
              requestId,
            });
          }
          setIdentity(identity);
        } catch (error) {
          // Wrong credentials are an expected outcome, not a client failure to report.
          const isExpected =
            error instanceof AuthenticationError &&
            error.normalized.code === AuthErrorCode.AuthenticationFailed;
          if (!isExpected) {
            void captureClientError(errorReporter, { error, operation: "sign_in", requestId });
          }
          throw error;
        }
      },
      signOut: async () => {
        const requestId = makeRequestId();
        try {
          await signOut(supabase as unknown as AuthClient);
        } catch (error) {
          void captureClientError(errorReporter, { error, operation: "sign_out", requestId });
        } finally {
          clear();
        }
      },
    }),
    [clear, isLoading, session, setIdentity, veterinarianId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return value;
}
