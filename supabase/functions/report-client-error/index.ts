type ClientErrorPayload = {
  operation?: unknown;
  requestId?: unknown;
  error?: { name?: unknown; message?: unknown };
};

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const safeText = (value: unknown, fallback: string) =>
  typeof value === "string" && value.length <= 160 ? value : fallback;

Deno.serve(async (request) => {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  let payload: ClientErrorPayload = {};
  try {
    payload = (await request.json()) as ClientErrorPayload;
  } catch {
    return Response.json({ code: "INVALID_INPUT", requestId }, { status: 400 });
  }

  // Never persist request bodies, auth headers, tokens, or clinical content.
  console.error(
    JSON.stringify({
      event: "client_error",
      requestId,
      operation: safeText(payload.operation, "unknown"),
      error: {
        name: safeText(payload.error?.name, "Error"),
      },
      timestamp: new Date().toISOString(),
    }),
  );

  return Response.json({ accepted: true, requestId });
});
