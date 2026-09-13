export const AuthErrorCode = {
  AuthenticationFailed: "AUTHENTICATION_FAILED",
  ServiceUnavailable: "SERVICE_UNAVAILABLE",
  Unknown: "UNKNOWN",
} as const;

export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export type NormalizedAuthError = {
  code: AuthErrorCode;
  publicMessage: string;
  requestId?: string;
};

function readErrorProperty(error: unknown, property: string): unknown {
  if (typeof error !== "object" || error === null || !(property in error)) {
    return undefined;
  }

  return (error as Record<string, unknown>)[property];
}

export function normalizeAuthError(error: unknown, requestId?: string): NormalizedAuthError {
  const status = readErrorProperty(error, "status");
  const providerCode = readErrorProperty(error, "code");
  const message = readErrorProperty(error, "message");
  const messageText = typeof message === "string" ? message.toLowerCase() : "";
  const codeText = typeof providerCode === "string" ? providerCode.toLowerCase() : "";
  const isInvalidCredentials =
    status === 400 ||
    codeText.includes("invalid") ||
    codeText.includes("not_found") ||
    messageText.includes("invalid login") ||
    messageText.includes("invalid credentials") ||
    messageText.includes("user not found") ||
    messageText.includes("authentication_required") ||
    codeText.includes("authentication_required");

  if (isInvalidCredentials) {
    return {
      code: AuthErrorCode.AuthenticationFailed,
      publicMessage: "Identificador o contraseña incorrectos.",
      requestId,
    };
  }

  if (typeof status === "number" && status >= 500) {
    return {
      code: AuthErrorCode.ServiceUnavailable,
      publicMessage: "No pudimos completar la operación. Inténtalo nuevamente más tarde.",
      requestId,
    };
  }

  return {
    code: AuthErrorCode.Unknown,
    publicMessage: "No pudimos iniciar sesión. Inténtalo nuevamente.",
    requestId,
  };
}

export class AccessDeniedError extends Error {
  readonly code = "ACCESS_DENIED";

  constructor(message = "La sesión no permite realizar esta operación.") {
    super(message);
    this.name = "AccessDeniedError";
  }
}
