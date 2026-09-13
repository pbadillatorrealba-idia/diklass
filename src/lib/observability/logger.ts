export type LogContext = {
  requestId?: string;
  userId?: string;
  clinicId?: string;
  operation?: string;
  durationMs?: number;
};

const SENSITIVE_KEYS = /password|token|secret|authorization|content|clinical/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      SENSITIVE_KEYS.test(key) ? "[REDACTED]" : redact(entry),
    ]),
  );
}

export function logEvent(event: string, context: LogContext = {}): void {
  if (__DEV__) {
    console.info(
      JSON.stringify({
        event,
        ...(redact(context) as Record<string, unknown>),
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

export function redactLogContext(context: Record<string, unknown>): Record<string, unknown> {
  return redact(context) as Record<string, unknown>;
}
