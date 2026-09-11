export type LogContext = {
  requestId?: string;
  userId?: string;
  clinicId?: string;
  operation?: string;
  durationMs?: number;
  errorName?: string;
};

export type LogLevel = "info" | "error";

export type LogSink = (line: string, level: LogLevel) => void;

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

const consoleSink: LogSink = (line, level) => {
  if (level === "error") {
    console.error(line);
  } else {
    console.info(line);
  }
};

let sink: LogSink = consoleSink;

/** Replaces where structured lines are written; `null` restores the console sink. */
export function setLogSink(next: LogSink | null): void {
  sink = next ?? consoleSink;
}

/**
 * Emits one machine-readable line in every build. Failures additionally travel to
 * the central destination through `captureClientError` (Constitution IV).
 */
export function logEvent(event: string, context: LogContext = {}, level: LogLevel = "info"): void {
  sink(
    JSON.stringify({
      event,
      level,
      ...(redact(context) as Record<string, unknown>),
      timestamp: new Date().toISOString(),
    }),
    level,
  );
}

export function redactLogContext(context: Record<string, unknown>): Record<string, unknown> {
  return redact(context) as Record<string, unknown>;
}
