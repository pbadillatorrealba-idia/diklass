import {
  type AccessSessionRpcClient,
  startAccessSession,
} from "@/features/auth/access-session-service";
import { AuthErrorCode, type NormalizedAuthError, normalizeAuthError } from "@/lib/errors";
import type { LoginValues } from "@/lib/forms/form";
import { makeRequestId } from "@/lib/observability/client-error-reporter";

export type AuthUser = { id: string; email?: string };

export type AuthClient = AccessSessionRpcClient & {
  auth: {
    signInWithPassword: (credentials: LoginValues) => Promise<{
      data: { user: AuthUser | null; session: unknown | null };
      error: unknown | null;
    }>;
    signOut: () => Promise<{ error: unknown | null }>;
  };
};

export type SignInResult = {
  user: AuthUser;
  accessSessionId: string;
  accessSessionExpiresAt: string;
};

export class AuthenticationError extends Error {
  readonly normalized: NormalizedAuthError;

  constructor(normalized: NormalizedAuthError) {
    super(normalized.publicMessage);
    this.name = "AuthenticationError";
    this.normalized = normalized;
  }
}

export async function signInWithPassword(
  client: AuthClient,
  credentials: LoginValues,
  requestId = makeRequestId(),
): Promise<SignInResult> {
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.user) {
    throw new AuthenticationError(normalizeAuthError(error ?? { status: 401 }, requestId));
  }

  try {
    const accessSession = await startAccessSession(client);
    if (!accessSession || typeof accessSession !== "object") {
      throw new Error("Missing access session");
    }

    const result = accessSession as { id?: unknown; expiresAt?: unknown; expires_at?: unknown };
    if (typeof result.id !== "string") {
      throw new Error("Missing access session id");
    }

    const expiresAt = result.expiresAt ?? result.expires_at;
    if (typeof expiresAt !== "string") {
      throw new Error("Missing access session expiration");
    }

    return { user: data.user, accessSessionId: result.id, accessSessionExpiresAt: expiresAt };
  } catch (sessionError) {
    await client.auth.signOut();
    throw new AuthenticationError(normalizeAuthError(sessionError, requestId));
  }
}

export async function signOut(client: AuthClient): Promise<void> {
  await client.rpc<boolean>("revoke_access_sessions");
  const { error } = await client.auth.signOut();
  if (error && normalizeAuthError(error).code === AuthErrorCode.ServiceUnavailable) {
    throw error;
  }
}
