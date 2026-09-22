import { logEvent, redactLogContext } from "@/lib/observability/logger";

export type ErrorReporterClient = {
  functions: {
    invoke: (
      name: string,
      options: { body: Record<string, unknown>; headers?: Record<string, string> },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

export type ClientErrorInput = {
  error: unknown;
  operation: string;
  requestId: string;
};

export function makeRequestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

const errorName = (error: unknown) => (error instanceof Error ? error.name : "Error");

export async function reportClientError(
  client: ErrorReporterClient,
  { error, operation, requestId }: ClientErrorInput,
): Promise<void> {
  const { error: invokeError } = await client.functions.invoke("report-client-error", {
    // Only the error class travels: a message can carry clinical content.
    body: redactLogContext({ error: { name: errorName(error) }, operation, requestId }),
    headers: { "x-request-id": requestId },
  });
  if (invokeError) {
    throw new Error(invokeError.message);
  }
}

/**
 * Logs a client failure and forwards it to the central destination. Never throws,
 * so it is safe on any failure path; a report that itself fails is logged, not lost.
 */
export async function captureClientError(
  client: ErrorReporterClient,
  input: ClientErrorInput,
): Promise<void> {
  const { operation, requestId } = input;
  logEvent("client_error", { requestId, operation, errorName: errorName(input.error) }, "error");
  try {
    await reportClientError(client, input);
  } catch (reportError) {
    logEvent(
      "client_error_report_failed",
      { requestId, operation, errorName: errorName(reportError) },
      "error",
    );
  }
}
