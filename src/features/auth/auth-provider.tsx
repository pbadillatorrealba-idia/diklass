import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { type AuthClient, signInWithPassword, signOut } from "@/features/auth/auth-service";
import type { LoginValues } from "@/lib/forms/form";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signIn: (values: LoginValues) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const setIdentity = useSessionStore((state) => state.setIdentity);
  const clear = useSessionStore((state) => state.clear);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        clear();
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [clear]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signIn: async (values) => {
        const result = await signInWithPassword(supabase as unknown as AuthClient, values);
        const { data } = await supabase
          .from("veterinarians")
          .select("id, display_name")
          .eq("id", result.user.id)
          .single();
        if (!data) {
          await supabase.auth.signOut();
          throw new Error("La cuenta no está provisionada.");
        }
        setIdentity({
          veterinarianId: data.id,
          displayName: data.display_name,
          accessSessionId: result.accessSessionId,
        });
      },
      signOut: async () => {
        await signOut(supabase as unknown as AuthClient);
        clear();
      },
    }),
    [clear, isLoading, session, setIdentity],
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
