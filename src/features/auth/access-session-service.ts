export const ACCESS_SESSION_INACTIVITY_MS = 8 * 60 * 60 * 1000;

// Client-side session-store state (src/stores/session-store.ts), not a column on
// access_sessions -- the deleted getAccessSessionState/AccessSessionSnapshot pair modeled a
// status column the table does not have, but this type itself is live: it gates clinical UI
// in src/app/(protected)/consultations/[id].tsx via useSessionStore.
export type AccessSessionState = "active" | "expired" | "revoked";

export type AccessSessionRpcClient = {
  rpc: <T>(
    functionName: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{
    data: T | null;
    error: { message: string } | null;
  }>;
};

export async function startAccessSession(client: AccessSessionRpcClient) {
  const { data, error } = await client.rpc<unknown>("start_access_session");
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function touchAccessSession(client: AccessSessionRpcClient, sessionId: string) {
  const { data, error } = await client.rpc<boolean>("touch_access_session", {
    p_session_id: sessionId,
  });
  if (error) {
    throw new Error(error.message);
  }
  return data === true;
}

export type CurrentAccessSession = { id: string; expiresAt: string };

/**
 * The access session bound to the Auth session of the current JWT, or null. A restored
 * Supabase session must resume only this one: the newest non-revoked row of the
 * veterinarian could belong to another device.
 */
export async function getCurrentAccessSession(
  client: AccessSessionRpcClient,
): Promise<CurrentAccessSession | null> {
  const { data, error } = await client.rpc<unknown>("current_access_session");
  if (error) {
    throw new Error(error.message);
  }
  if (!data || typeof data !== "object") {
    return null;
  }
  const { id, expiresAt } = data as { id?: unknown; expiresAt?: unknown };
  return typeof id === "string" && typeof expiresAt === "string" ? { id, expiresAt } : null;
}
