import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  assertManifestMatches,
  type DemoManifest,
  demoHash,
} from "../../../scripts/demo/cargar-demo";

const directory = mkdtempSync(join(tmpdir(), "diklass-demo-"));
const root = resolve(import.meta.dir, "../../..");
afterAll(() => rmSync(directory, { recursive: true, force: true }));

test("rechaza veterinarios vacíos antes de autenticar o escribir", () => {
  const fixture = join(directory, "veterinarios.json");
  writeFileSync(fixture, "[]");
  const result = Bun.spawnSync(
    [process.execPath, "scripts/provision-demo-data.ts", "--fixture", fixture],
    {
      cwd: root,
      env: {
        ...process.env,
        SUPABASE_URL: "http://127.0.0.1:1",
        EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon-prueba",
      },
    },
  );
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("fixture de veterinarios");
  expect(result.stderr.toString()).not.toContain("fetch failed");
});

const complete: DemoManifest = {
  datasetId: "diklass-clinica-demo",
  version: "1.0.0",
  revision: "revision-test",
  fixtureHash: "contenido-fixture",
  target: "http://127.0.0.1:55321",
  clinicId: "00000000-0000-0000-0000-000000000001",
  status: "complete",
  startedAt: "2026-10-27T12:00:00Z",
  entities: { T01: { id: "00000000-0000-4000-8000-000000000001", hash: "a".repeat(64) } },
  events: {},
};
const expected = {
  target: complete.target,
  clinicId: complete.clinicId,
  fixtureHash: complete.fixtureHash,
  keys: ["T01"],
};

test("la repetición exige estado completo, misma versión y grafo exacto", () => {
  expect(() => assertManifestMatches(structuredClone(complete), expected)).not.toThrow();
  expect(() => assertManifestMatches({ ...complete, status: "partial" }, expected)).toThrow(
    "parcial",
  );
  expect(() => assertManifestMatches({ ...complete, version: "0.9.0" }, expected)).toThrow(
    "diferente",
  );
  expect(() => assertManifestMatches({ ...complete, fixtureHash: "otro" }, expected)).toThrow(
    "diferente",
  );
  expect(() => assertManifestMatches({ ...complete, entities: {} }, expected)).toThrow("Grafo");
  expect(() =>
    assertManifestMatches(complete, { ...expected, target: "http://localhost:1" }),
  ).toThrow("diferente");
});

test("comparar JSONB no depende del orden de sus claves", () => {
  expect(demoHash({ a: [1, { b: 2, c: 3 }], z: null })).toBe(
    demoHash({ z: null, a: [1, { c: 3, b: 2 }] }),
  );
  expect(demoHash({ a: 1 })).not.toBe(demoHash({ a: 2 }));
});

test("un fixture mal formado se rechaza antes de autenticar", () => {
  const fixture = join(directory, "malformado.json");
  writeFileSync(
    fixture,
    JSON.stringify([{ email: "no-es-correo", password: "", displayName: "" }]),
  );
  const result = Bun.spawnSync(
    [process.execPath, "scripts/provision-demo-data.ts", "--fixture", fixture],
    {
      cwd: root,
      env: {
        ...process.env,
        SUPABASE_URL: "http://127.0.0.1:1",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon",
      },
    },
  );
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("fixture de veterinarios");
});

test("el reset explícito retira solo su manifiesto después de reiniciar su mismo destino", () => {
  const bin = join(directory, "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(
    join(bin, "supabase"),
    '#!/bin/sh\nif [ "$1" = "status" ]; then echo \'{"API_URL":"http://127.0.0.1:1"}\'; fi\nexit 0\n',
    { mode: 0o700 },
  );
  const manifest = join(directory, "reset.json");
  const other = join(directory, "otro-destino.json");
  writeFileSync(manifest, JSON.stringify({ ...complete, target: "http://127.0.0.1:1" }));
  writeFileSync(other, "no tocar");
  const result = Bun.spawnSync(
    [process.execPath, "run", "demo:reset", "--", "--manifest", manifest],
    {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        SUPABASE_URL: "http://127.0.0.1:1",
        EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      },
    },
  );
  // El provisioning posterior no conecta al puerto cerrado; el reset ya fue exitoso.
  expect(result.exitCode).not.toBe(0);
  expect(existsSync(manifest)).toBe(false);
  expect(existsSync(other)).toBe(true);
});
