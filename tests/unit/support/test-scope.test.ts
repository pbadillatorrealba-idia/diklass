import { afterEach, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as lifecycle from "../../support/test-scope";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

test("persiste raíces antes de provisionar y no guarda contraseñas en el registro", () => {
  const directory = mkdtempSync(join(tmpdir(), "scope-"));
  directories.push(directory);
  const scope = lifecycle.createScopeFiles(directory, "suite", {
    projectId: "diklass-test",
    url: "http://127.0.0.1:55321",
    databaseUrl: "postgresql://u:p@127.0.0.1:55322/postgres",
  });
  const state = JSON.parse(readFileSync(scope.path, "utf8"));
  const actors = lifecycle.readTestActors({
    TEST_BACKEND: "1",
    TEST_ACTORS_FILE: scope.actorsPath,
  });
  expect(state.actorEmails).toEqual(actors.map((actor) => actor.email));
  expect(state.clinicId).toMatch(/^[a-f0-9-]{36}$/);
  expect(readFileSync(scope.path, "utf8")).not.toContain(actors[0]?.password);
  expect(statSync(scope.path).mode & 0o777).toBe(0o600);
  expect(statSync(scope.actorsPath).mode & 0o777).toBe(0o600);
  const reserved = lifecycle.reserveTestEmail("signup", { TEST_SCOPE_FILE: scope.path });
  expect(JSON.parse(readFileSync(scope.path, "utf8")).actorEmails).toContain(reserved);
});

test("el backend explícito exige actores del scope y rechaza archivos públicos", () => {
  expect(() => lifecycle.readTestActors({ TEST_BACKEND: "1" })).toThrow();
  expect(() => lifecycle.reserveTestEmail("signup", {})).toThrow();
});

test("rechaza credenciales legibles por otros usuarios y scopes manipulados", () => {
  const directory = mkdtempSync(join(tmpdir(), "scope-"));
  directories.push(directory);
  const scope = lifecycle.createScopeFiles(directory, "suite", {
    projectId: "diklass-test",
    url: "http://127.0.0.1:55321",
    databaseUrl: "postgresql://u:p@127.0.0.1:55322/postgres",
  });
  chmodSync(scope.actorsPath, 0o644);
  expect(() => lifecycle.readTestActors({ TEST_ACTORS_FILE: scope.actorsPath })).toThrow();
  const state = JSON.parse(readFileSync(scope.path, "utf8"));
  state.actorEmails.push("vet.ana@example.test");
  writeFileSync(scope.path, JSON.stringify(state));
  expect(() => lifecycle.reserveTestEmail("signup", { TEST_SCOPE_FILE: scope.path })).toThrow();
});

test("la recuperación rechaza el destino diferente antes de acceder al backend", async () => {
  const directory = mkdtempSync(join(tmpdir(), "scope-"));
  directories.push(directory);
  const scope = lifecycle.createScopeFiles(directory, "suite", {
    projectId: "diklass-test",
    url: "http://127.0.0.1:55321",
    databaseUrl: "postgresql://u:p@127.0.0.1:55322/postgres",
  });
  await expect(
    lifecycle.recoverTestScope(
      {
        projectId: "diklass-test-other",
        url: "http://127.0.0.1:55321",
        databaseUrl: "postgresql://u:p@127.0.0.1:55322/postgres",
        anonKey: "public",
        serviceRoleKey: "private",
        webPort: 8083,
      },
      scope.path,
    ),
  ).rejects.toThrow("destino");
});

test("config temporal deriva proyecto y puertos sin modificar la fuente", async () => {
  const { prepareBackendConfiguration } = await import("../../../scripts/test-backend");
  const directory = mkdtempSync(join(tmpdir(), "backend-"));
  directories.push(directory);
  const source =
    'project_id = "diklass"\n[api]\nport = 54321\n[db]\nport = 54322\nmajor_version = 17\n';
  const text = prepareBackendConfiguration(source);
  const config = Bun.TOML.parse(text) as Record<string, unknown>;
  expect(config.project_id).toBe("diklass-testing");
  expect(config.api).toEqual({ port: 55321 });
  expect(config.db).toEqual({ port: 55322, shadow_port: 55320, major_version: 17 });
  expect(config.edge_runtime).toEqual({ inspector_port: 55383 });
});

test("el runner conserva archivos separados y obliga un worker web", async () => {
  const { testCommand } = await import("../../../scripts/run-isolated-tests");
  expect(testCommand("integration", "tests/integration/auth/access-session.test.ts")).toEqual([
    "bun",
    "test",
    "tests/integration/auth/access-session.test.ts",
  ]);
  expect(testCommand("web", "tests/e2e/web/auth.spec.ts")).toEqual([
    "bunx",
    "playwright",
    "test",
    "tests/e2e/web/auth.spec.ts",
    "--workers=1",
  ]);
  expect(() => testCommand("integration", "--preload=foreign.ts")).toThrow();
});

test("reserva rutas Storage y claves editoriales antes de subir", () => {
  const directory = mkdtempSync(join(tmpdir(), "scope-"));
  directories.push(directory);
  const scope = lifecycle.createScopeFiles(directory, "suite", {
    projectId: "diklass-test",
    url: "http://127.0.0.1:55321",
    databaseUrl: "postgresql://u:p@127.0.0.1:55322/postgres",
  });
  const env = { TEST_SCOPE_FILE: scope.path };
  const path = `${scope.state.clinicId}/audio.webm`;
  lifecycle.reserveTestStorageObject("consultation-audio", path, env);
  lifecycle.recordTestDatasetKey("P01", env);
  const state = JSON.parse(readFileSync(scope.path, "utf8"));
  expect(state.storage).toEqual([{ bucket_id: "consultation-audio", name: path }]);
  expect(state.datasetKeys).toEqual(["P01"]);
  expect(() =>
    lifecycle.reserveTestStorageObject("consultation-audio", "foreign/audio.webm", env),
  ).toThrow();
});

test("reserva RUT durable sin reutilizar cuerpos tras releer o agotar el bloque", () => {
  const directory = mkdtempSync(join(tmpdir(), "scope-"));
  directories.push(directory);
  const scope = lifecycle.createScopeFiles(directory, "suite", {
    projectId: "diklass-test",
    url: "http://127.0.0.1:55321",
    databaseUrl: "postgresql://u:p@127.0.0.1:55322/postgres",
  });
  const env = { TEST_SCOPE_FILE: scope.path };
  expect(() => lifecycle.reserveTestRutBody(env)).toThrow();
  const state = JSON.parse(readFileSync(scope.path, "utf8"));
  state.rutNext = 10000000;
  state.rutEnd = 10000001;
  writeFileSync(scope.path, JSON.stringify(state));
  expect(lifecycle.reserveTestRutBody(env)).toBe(10000000);
  expect(lifecycle.reserveTestRutBody(env)).toBe(10000001);
  expect(() => lifecycle.reserveTestRutBody(env)).toThrow("agotado");
});

test("el checkpoint guarda solo PKs y conserva filas ya registradas", () => {
  const directory = mkdtempSync(join(tmpdir(), "scope-"));
  directories.push(directory);
  const scope = lifecycle.createScopeFiles(directory, "suite", {
    projectId: "diklass-test",
    url: "http://127.0.0.1:55321",
    databaseUrl: "postgresql://u:p@127.0.0.1:55322/postgres",
  });
  const env = { TEST_SCOPE_FILE: scope.path };
  const id = "00000000-0000-4000-8000-000000000001";
  lifecycle.rememberTestRows(
    "assistant_messages",
    [{ id, parts: [{ text: "dato que no pertenece al reporte" }], password: "secreto" }],
    env,
  );
  lifecycle.rememberTestRows("assistant_messages", [{ id }], env);
  const state = JSON.parse(readFileSync(scope.path, "utf8"));
  expect(state.remembered.assistant_messages).toEqual([{ id }]);
  expect(readFileSync(scope.path, "utf8")).not.toContain("secreto");
  expect(() => lifecycle.rememberTestRows("auth.users", [{ id }], env)).toThrow();
  expect(() => lifecycle.rememberTestRows("assistant_messages", [{}], env)).toThrow();
});
