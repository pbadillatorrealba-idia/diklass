import { createClient } from "@supabase/supabase-js";

declare const Deno: { env: { get: (name: string) => string | undefined } };

/**
 * Cliente que actúa con el JWT del solicitante (clave anónima + su `Authorization`): la RLS decide qué ve
 * y `auth.uid()` es él. Sin sesión persistente: cada petición es independiente.
 */
export const asUser = (authorization: string) =>
  createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
