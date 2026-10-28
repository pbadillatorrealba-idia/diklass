import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { resolveTestConfig } from "../support/test-config";
import { trackedTestFetch } from "../support/test-network";
import { readTestActors } from "../support/test-scope";

const config = resolveTestConfig(process.env);
const url = config?.url;
const anonKey = config?.anonKey;
const serviceRoleKey = config?.serviceRoleKey;
if (process.env.SUPABASE_LIVE_TESTS === "1" && !process.env.TEST_SCOPE_FILE) {
  throw new Error(
    "Las suites vivas requieren el runner aislado y TEST_SCOPE_FILE; no se usan cuentas compartidas.",
  );
}

/**
 * Opt-in: these suites need `supabase start`, `supabase db reset` and the synthetic
 * veterinarians provisioned. CI sets SUPABASE_LIVE_TESTS=1 in the database job only.
 */
export const isLiveSupabase =
  process.env.SUPABASE_LIVE_TESTS === "1" && Boolean(url && anonKey && serviceRoleKey);

const actors = readTestActors();
export const ANA = actors[0] as { email: string; password: string };
export const BRUNO = actors[1] as { email: string; password: string };

const noPersistence = {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: trackedTestFetch },
};

export function anonymousClient(): SupabaseClient<Database> {
  return createClient<Database>(url ?? "", anonKey ?? "", noPersistence);
}

/**
 * Service role: only to arrange state the API deliberately refuses (e.g. the clock).
 * Untyped on purpose: the app types forbid these writes, which is correct for app clients.
 */
export function adminClient(): SupabaseClient {
  return createClient(url ?? "", serviceRoleKey ?? "", noPersistence);
}

/** A client that keeps presenting a captured access token, as a stale tab would. */
export function clientWithToken(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(url ?? "", anonKey ?? "", {
    ...noPersistence,
    global: { fetch: trackedTestFetch, headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export type LiveVeterinarian = {
  client: SupabaseClient<Database>;
  userId: string;
  accessToken: string;
  accessSessionId: string;
  clinicId: string;
};

export async function signedInVeterinarian(credentials: {
  email: string;
  password: string;
}): Promise<LiveVeterinarian> {
  const client = anonymousClient();
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.user || !data.session) {
    throw error ?? new Error(`No se pudo iniciar sesión como ${credentials.email}`);
  }

  const { data: accessSession, error: sessionError } = await client.rpc("start_access_session");
  if (sessionError) {
    throw sessionError;
  }

  const { data: profile, error: profileError } = await client
    .from("veterinarians")
    .select("clinic_id")
    .eq("id", data.user.id)
    .single();
  if (profileError) {
    throw profileError;
  }

  return {
    client,
    userId: data.user.id,
    accessToken: data.session.access_token,
    accessSessionId: (accessSession as { id: string }).id,
    clinicId: profile.clinic_id,
  };
}
