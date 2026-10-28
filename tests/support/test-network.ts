import { readFileSync } from "node:fs";
import type { APIRequestContext } from "@playwright/test";
import { rememberTestRows, reserveTestStorageObject, type ScopeState } from "./test-scope";

type Environment = Record<string, string | undefined>;
const originalFetch = globalThis.fetch.bind(globalThis);
const endpoints = [
  "/rest/v1/rpc/delete_assistant_conversation",
  "/functions/v1/delete-assistant-conversation",
];

function ownedAuthor(payload: unknown, env: Environment): string | undefined {
  if (!env.TEST_SCOPE_FILE || !payload || typeof payload !== "object") return;
  const { sub, email } = payload as { sub?: unknown; email?: unknown };
  if (
    typeof sub !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sub)
  )
    return;
  const scope = JSON.parse(readFileSync(env.TEST_SCOPE_FILE, "utf8")) as ScopeState;
  if (
    scope.actorIds.includes(sub) ||
    (typeof email === "string" && scope.actorEmails.includes(email))
  )
    return sub;
}

function authorFromHeaders(headers: Headers, env: Environment): string | undefined {
  const jwt = /^Bearer (\S+)$/i.exec(headers.get("authorization") ?? "")?.[1];
  if (jwt?.split(".").length !== 3) return;
  let payload: { role?: string };
  try {
    payload = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"));
  } catch {
    return;
  }
  // Vincula el actor al registro; la firma y la autorización las valida el servidor en el GET.
  if (payload?.role !== "authenticated") return;
  return ownedAuthor(payload, env);
}

function rememberMessages(rows: unknown, env: Environment): number {
  if (
    !Array.isArray(rows) ||
    rows.some(
      (row) =>
        !row ||
        typeof row.id !== "string" ||
        (row.audio_path != null && typeof row.audio_path !== "string"),
    )
  ) {
    throw new Error("Respuesta inválida al registrar mensajes antes del borrado.");
  }
  rememberTestRows(
    "assistant_messages",
    rows.map(({ id }) => ({ id })),
    env,
  );
  for (const row of rows) {
    if (row.audio_path) reserveTestStorageObject("assistant-audio", row.audio_path, env);
  }
  return rows.length;
}

/** Registra únicamente mensajes de un actor exclusivo, antes de que la aplicación los elimine. */
export async function checkpointConversation(
  url: string,
  headers: HeadersInit,
  env: Environment = process.env,
): Promise<void> {
  if (!env.TEST_SCOPE_FILE) return;
  const target = new URL(url);
  const requestHeaders = new Headers(headers);
  // El GET conserva autorización y apikey, pero no anuncia el cuerpo del POST interceptado.
  requestHeaders.delete("content-length");
  const author = authorFromHeaders(requestHeaders, env);
  if (!author) return;
  if (target.origin !== new URL(env.TEST_SUPABASE_URL ?? "").origin)
    throw new Error("El checkpoint no corresponde al backend de testing.");
  const query = new URL("/rest/v1/assistant_messages", target);
  query.searchParams.set("select", "id,audio_path");
  query.searchParams.set("author_id", `eq.${author}`);
  query.searchParams.set("limit", "1000");
  query.searchParams.set("order", "id");
  for (let offset = 0; ; offset += 1000) {
    query.searchParams.set("offset", String(offset));
    const response = await originalFetch(query, { headers: requestHeaders });
    if (response.status === 401 || response.status === 403) {
      await response.body?.cancel();
      return;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Falló el checkpoint de mensajes antes del borrado.");
    }
    const rows: unknown = await response.json();
    if (rememberMessages(rows, env) < 1000) return;
  }
}

/** Custom fetch de Supabase: el resto de solicitudes conserva su transporte original. */
export const trackedTestFetch = Object.assign(
  async function trackedTestFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
    env: Environment = process.env,
  ): Promise<Response> {
    const url = input instanceof Request ? input.url : String(input);
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    if (method.toUpperCase() === "POST" && endpoints.includes(new URL(url).pathname)) {
      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      new Headers(init?.headers).forEach((value, key) => {
        headers.set(key, value);
      });
      await checkpointConversation(url, headers, env);
    }
    return originalFetch(input, init);
  },
  { preconnect: globalThis.fetch.preconnect },
);

/** APIRequestContext mantiene sus headers privados: recupera el autor autenticado por el API. */
export async function checkpointApiConversation(
  api: APIRequestContext,
  env: Environment = process.env,
): Promise<void> {
  if (!env.TEST_SCOPE_FILE) return;
  const user = await api.get("/auth/v1/user");
  if (user.status() === 401 || user.status() === 403) return;
  if (!user.ok()) throw new Error("No se pudo verificar el autor del checkpoint de mensajes.");
  const payload = await user.json();
  const author = ownedAuthor({ sub: payload.id, email: payload.email }, env);
  if (!author) return;
  for (let offset = 0; ; offset += 1000) {
    const response = await api.get(
      `/rest/v1/assistant_messages?select=id,audio_path&author_id=eq.${author}&order=id&limit=1000&offset=${offset}`,
    );
    if (response.status() === 401 || response.status() === 403) return;
    if (!response.ok()) throw new Error("Falló el checkpoint de mensajes antes del borrado.");
    const rows: unknown = await response.json();
    if (rememberMessages(rows, env) < 1000) return;
  }
}
