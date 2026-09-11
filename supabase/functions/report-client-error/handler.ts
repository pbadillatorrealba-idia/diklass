import { z } from "zod";

/**
 * Every header supabase.functions.invoke sends from a browser must be allowed, or the
 * preflight fails and no report is sent (supabase.com/docs/guides/functions/cors).
 */
// `as const satisfies` keeps the literal keys typed (instead of widening to
// `string | undefined` under `noUncheckedIndexedAccess`) while still checking
// against the `Record<string, string>` shape the interface documents.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
} as const satisfies Record<string, string>;

export const MAX_BODY_BYTES = 2048;

const identifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[\w.-]+$/);

// Only identifiers travel: an error message can carry clinical content. Unknown keys are
// stripped by the schema, so they never reach the log.
export const clientErrorReportSchema = z.object({
  operation: identifier,
  requestId: z.string().min(1).max(160).optional(),
  error: z.object({ name: identifier }),
});

export type ReportDependencies = {
  log: (line: string) => void;
  randomId: () => string;
};

const respond = (body: Record<string, unknown>, status: number) =>
  Response.json(body, { status, headers: corsHeaders });

const safeRequestId = (value: string | null | undefined) =>
  value && value.length <= 160 && /^[\w.-]+$/.test(value) ? value : null;

export async function handleClientErrorReport(
  request: Request,
  deps: ReportDependencies,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const headerRequestId = safeRequestId(request.headers.get("x-request-id"));
  if (request.method !== "POST") {
    return respond(
      { code: "METHOD_NOT_ALLOWED", requestId: headerRequestId ?? deps.randomId() },
      405,
    );
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return respond(
      { code: "PAYLOAD_TOO_LARGE", requestId: headerRequestId ?? deps.randomId() },
      413,
    );
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    candidate = undefined;
  }
  const parsed = clientErrorReportSchema.safeParse(candidate);
  if (!parsed.success) {
    return respond({ code: "INVALID_INPUT", requestId: headerRequestId ?? deps.randomId() }, 400);
  }

  // The header wins so the id matches the SQL logs, which read x-request-id (request_id()).
  const requestId = headerRequestId ?? safeRequestId(parsed.data.requestId) ?? deps.randomId();
  deps.log(
    JSON.stringify({
      event: "client_error",
      requestId,
      operation: parsed.data.operation,
      error: { name: parsed.data.error.name },
      timestamp: new Date().toISOString(),
    }),
  );
  return respond({ accepted: true, requestId }, 200);
}
