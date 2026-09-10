import { redactLogContext } from "@/lib/observability/logger";

type ErrorReporterClient = {
  functions: {
    invoke: (
      name: string,
      options: { body: Record<string, unknown> },
    ) => Promise<{ error: { message: string } | null }>;
  };
};

type ClientErrorInput = {
  error: unknown;
  operation: string;
  requestId: string;
};

export async function reportClientError(
  client: ErrorReporterClient,
  { error, operation, requestId }: ClientErrorInput,
): Promise<void> {
  await client.functions.invoke("report-client-error", {
    body: redactLogContext({
      error: { name: error instanceof Error ? error.name : "Error" },
      operation,
      requestId,
    }),
  });
}
