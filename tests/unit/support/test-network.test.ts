import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as apiRequest } from "@playwright/test";
import { checkpointApiConversation, trackedTestFetch } from "../../support/test-network";
import { createScopeFiles } from "../../support/test-scope";

const author = "ab000000-0000-4000-8000-000000000001";
const message = "ab000000-0000-4000-8000-000000000002";
const token = (payload: unknown) =>
  `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;

for (const endpoint of [
  "/rest/v1/rpc/delete_assistant_conversation",
  "/functions/v1/delete-assistant-conversation",
]) {
  test(`persiste IDs y audio antes de despachar ${endpoint}`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "diklass-network-"));
    const scope = createScopeFiles(dir, "network", {
      projectId: "diklass-testing",
      url: "http://localhost:55321",
      databaseUrl: "postgresql://postgres:placeholder@localhost:55322/postgres",
    });
    const audio = `${scope.state.clinicId}/${author}/${message}.webm`;
    const jwt = token({ sub: author, email: scope.state.actorEmails[0], role: "authenticated" });
    const requests: string[] = [];
    let checkpoint: Record<string, unknown> | undefined;
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        const url = new URL(request.url);
        requests.push(`${request.method} ${url.pathname}`);
        if (request.method === "GET") {
          expect(url.searchParams.get("select")).toBe("id,audio_path");
          expect(url.searchParams.get("author_id")).toBe(`eq.${author}`);
          expect(request.headers.get("authorization")).toBe(`Bearer ${jwt}`);
          return Response.json([
            { id: message, audio_path: audio, content: "never-persist-content" },
          ]);
        }
        checkpoint = JSON.parse(readFileSync(scope.path, "utf8"));
        return Response.json(1);
      },
    });
    try {
      const response = await trackedTestFetch(
        new Request(new URL(endpoint, server.url), {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}`, apikey: "public-key" },
        }),
        undefined,
        { TEST_SCOPE_FILE: scope.path, TEST_SUPABASE_URL: server.url.origin },
      );
      expect(response.ok).toBe(true);
      expect(requests).toEqual(["GET /rest/v1/assistant_messages", `POST ${endpoint}`]);
      expect(checkpoint?.remembered).toEqual({ assistant_messages: [{ id: message }] });
      expect(checkpoint?.storage).toEqual([{ bucket_id: "assistant-audio", name: audio }]);
      expect(JSON.stringify(checkpoint)).not.toContain(jwt);
      expect(JSON.stringify(checkpoint)).not.toContain("never-persist-content");
    } finally {
      server.stop(true);
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const authorization of [
  undefined,
  "Bearer invalid",
  `Bearer ${token({ role: "anon" })}`,
  `Bearer ${token({ sub: author, email: "other@example.test", role: "authenticated" })}`,
]) {
  test(`no añade consultas con autor ausente, inválido o ajeno (${authorization?.split(" ")[0] ?? "ausente"})`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "diklass-network-"));
    const scope = createScopeFiles(dir, "network", {
      projectId: "diklass-testing",
      url: "http://localhost:55321",
      databaseUrl: "postgresql://postgres:placeholder@localhost:55322/postgres",
    });
    const methods: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        methods.push(request.method);
        return new Response(null, { status: 403 });
      },
    });
    try {
      const response = await trackedTestFetch(
        new URL("/rest/v1/rpc/delete_assistant_conversation", server.url),
        { method: "POST", headers: authorization ? { Authorization: authorization } : {} },
        { TEST_SCOPE_FILE: scope.path, TEST_SUPABASE_URL: server.url.origin },
      );
      expect(response.status).toBe(403);
      expect(methods).toEqual(["POST"]);
    } finally {
      server.stop(true);
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const status of [401, 403, 500]) {
  test(`checkpoint HTTP ${status}: conserva errores de autorización y bloquea otros fallos antes del borrado`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "diklass-network-"));
    const scope = createScopeFiles(dir, "network", {
      projectId: "diklass-testing",
      url: "http://localhost:55321",
      databaseUrl: "postgresql://postgres:placeholder@localhost:55322/postgres",
    });
    scope.state.actorIds = [author];
    writeFileSync(scope.path, JSON.stringify(scope.state));
    const methods: string[] = [];
    const server = Bun.serve({
      port: 0,
      fetch(request) {
        methods.push(request.method);
        return new Response(null, { status: request.method === "GET" ? status : 403 });
      },
    });
    try {
      const operation = trackedTestFetch(
        new URL("/rest/v1/rpc/delete_assistant_conversation", server.url),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token({ sub: author, role: "authenticated" })}` },
        },
        { TEST_SCOPE_FILE: scope.path, TEST_SUPABASE_URL: server.url.origin },
      );
      if (status === 500) {
        await expect(operation).rejects.toThrow();
        expect(methods).toEqual(["GET"]);
      } else {
        expect((await operation).status).toBe(403);
        expect(methods).toEqual(["GET", "POST"]);
      }
    } finally {
      server.stop(true);
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("otras rutas y métodos no consultan mensajes", async () => {
  const requests: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push(`${request.method} ${new URL(request.url).pathname}`);
      return Response.json([]);
    },
  });
  try {
    await trackedTestFetch(new URL("/rest/v1/assistant_messages", server.url));
    await trackedTestFetch(new URL("/rest/v1/rpc/another_rpc", server.url), { method: "POST" });
    await trackedTestFetch(new URL("/rest/v1/rpc/delete_assistant_conversation", server.url));
    expect(requests).toEqual([
      "GET /rest/v1/assistant_messages",
      "POST /rest/v1/rpc/another_rpc",
      "GET /rest/v1/rpc/delete_assistant_conversation",
    ]);
  } finally {
    server.stop(true);
  }
});

test("recuerda conversaciones que exceden el límite de una página antes del borrado", async () => {
  const dir = mkdtempSync(join(tmpdir(), "diklass-network-pages-"));
  const scope = createScopeFiles(dir, "network", {
    projectId: "diklass-testing",
    url: "http://localhost:55321",
    databaseUrl: "postgresql://postgres:placeholder@localhost:55322/postgres",
  });
  const lastId = "ab000000-0000-4000-8000-000000009999";
  let rememberedAtDelete: unknown;
  const offsets: string[] = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      if (request.method === "POST") {
        rememberedAtDelete = JSON.parse(readFileSync(scope.path, "utf8")).remembered;
        return Response.json(1);
      }
      const offset = new URL(request.url).searchParams.get("offset") ?? "0";
      offsets.push(offset);
      return Response.json(
        offset === "0"
          ? Array.from({ length: 1000 }, (_, index) => ({
              id: `ab000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
              audio_path: null,
            }))
          : [{ id: lastId, audio_path: null }],
      );
    },
  });
  try {
    await trackedTestFetch(
      new URL("/rest/v1/rpc/delete_assistant_conversation", server.url),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token({ sub: author, email: scope.state.actorEmails[0], role: "authenticated" })}`,
        },
      },
      { TEST_SCOPE_FILE: scope.path, TEST_SUPABASE_URL: server.url.origin },
    );
    expect(offsets).toEqual(["0", "1000"]);
    expect(rememberedAtDelete).toMatchObject({
      assistant_messages: expect.arrayContaining([{ id: lastId }]),
    });
  } finally {
    server.stop(true);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("APIRequestContext registra solo la conversación del usuario exclusivo antes del POST", async () => {
  const dir = mkdtempSync(join(tmpdir(), "diklass-api-checkpoint-"));
  const scope = createScopeFiles(dir, "network", {
    projectId: "diklass-testing",
    url: "http://localhost:55321",
    databaseUrl: "postgresql://postgres:placeholder@localhost:55322/postgres",
  });
  const requests: string[] = [];
  let remembered: unknown;
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      requests.push(`${request.method} ${url.pathname}`);
      if (url.pathname === "/auth/v1/user")
        return Response.json({ id: author, email: scope.state.actorEmails[0] });
      if (url.pathname === "/rest/v1/assistant_messages") {
        expect(url.searchParams.get("author_id")).toBe(`eq.${author}`);
        return Response.json([{ id: message, audio_path: null }]);
      }
      remembered = JSON.parse(readFileSync(scope.path, "utf8")).remembered;
      return Response.json(1);
    },
  });
  const api = await apiRequest.newContext({ baseURL: server.url.origin });
  try {
    await checkpointApiConversation(api, { TEST_SCOPE_FILE: scope.path });
    await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
    expect(remembered).toEqual({ assistant_messages: [{ id: message }] });
    expect(requests).toEqual([
      "GET /auth/v1/user",
      "GET /rest/v1/assistant_messages",
      "POST /rest/v1/rpc/delete_assistant_conversation",
    ]);
  } finally {
    await api.dispose();
    server.stop(true);
    rmSync(dir, { recursive: true, force: true });
  }
});
