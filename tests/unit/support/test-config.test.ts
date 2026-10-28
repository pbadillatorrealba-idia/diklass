import { describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveTestConfig, resolveWebConfig } from "../../support/test-config";

function loadPlaywrightConfig(env: Record<string, string> = {}) {
  return Bun.spawnSync(
    [
      process.execPath,
      "-e",
      'import config from "./playwright.config.ts"; console.log(JSON.stringify(config))',
    ],
    {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH ?? "", ...env },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
}

describe("destino de Playwright", () => {
  test("un puerto explícito dirige navegación, servidor y espera al mismo destino", () => {
    const result = loadPlaywrightConfig({ E2E_WEB_PORT: "9183", CI: "1" });
    expect(result.exitCode).toBe(0);
    const config = JSON.parse(result.stdout.toString());
    expect(config.use.baseURL).toBe("http://127.0.0.1:9183");
    expect(config.webServer.url).toBe("http://127.0.0.1:9183");
    expect(config.webServer.command).toBe("sh scripts/e2e-web-server.sh 9183");
    expect(config.workers).toBe(1);
  });

  test("solicitar backend sin TEST_* falla antes de arrancar un servidor", () => {
    expect(loadPlaywrightConfig({ E2E_BACKEND: "1" }).exitCode).not.toBe(0);
  });

  test("una URL de navegación que contradice el servidor gestionado falla", () => {
    expect(loadPlaywrightConfig({ PLAYWRIGHT_BASE_URL: "https://example.test" }).exitCode).not.toBe(
      0,
    );
  });
});

const testEnv = {
  TEST_SUPABASE_URL: "http://127.0.0.1:55321",
  TEST_SUPABASE_ANON_KEY: "public-test-key",
  TEST_DATABASE_URL: "postgresql://postgres:private-test-password@localhost:55322/postgres",
  TEST_SUPABASE_PROJECT_ID: "diklass-test-unit",
};

test("admite el proyecto local aislado diklass-testing y sigue rechazando desarrollo", () => {
  expect(
    resolveTestConfig({ ...testEnv, TEST_SUPABASE_PROJECT_ID: "diklass-testing" })?.projectId,
  ).toBe("diklass-testing");
});

test("el export recibe solo claves públicas del destino de testing y limpia su caché", () => {
  const result = loadPlaywrightConfig({
    ...testEnv,
    E2E_BACKEND: "1",
    TEST_SUPABASE_SERVICE_ROLE_KEY: "private-service-role",
  });
  expect(result.exitCode).toBe(0);
  const config = JSON.parse(result.stdout.toString());
  expect(config.webServer.env).toEqual({
    EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
    EXPO_NO_DOTENV: "1",
    E2E_CLEAR_CACHE: "1",
  });
});

test("un servidor ya gestionado por el runner evita reexportar por archivo", () => {
  const result = loadPlaywrightConfig({ ...testEnv, E2E_BACKEND: "1", TEST_WEB_SERVER_READY: "1" });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString()).webServer).toBeUndefined();
});

test("Playwright limita su limpieza de salida y conserva diarios y credenciales del runner", () => {
  const result = loadPlaywrightConfig();
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout.toString()).outputDir).toBe("test-results/playwright");
});

test("una ejecución mínima real de Playwright conserva los archivos hermanos de su salida", () => {
  const directory = mkdtempSync(join(tmpdir(), "pw-output-"));
  try {
    mkdirSync(join(directory, "specs"));
    mkdirSync(join(directory, "test-results/scopes"), { recursive: true });
    writeFileSync(join(directory, "package.json"), '{"type":"module"}');
    symlinkSync(resolve("node_modules"), join(directory, "node_modules"), "dir");
    const journal = join(directory, "test-results/scopes/marker.scope.json");
    const environment = join(directory, "test-results/backend.env");
    writeFileSync(journal, "journal-centinela");
    writeFileSync(environment, "entorno-centinela");
    writeFileSync(
      join(directory, "playwright.config.ts"),
      `
      import base from ${JSON.stringify(resolve("playwright.config.ts"))};
      import {resolve} from "node:path";
      export default {...base, testDir:"./specs", outputDir:resolve(import.meta.dirname,base.outputDir ?? "test-results"),
        webServer:undefined, reporter:"list", retries:0, projects:[{name:"regresion"}], use:{}};
    `,
    );
    writeFileSync(
      join(directory, "specs/output.spec.ts"),
      `
      import {test,expect} from "@playwright/test";
      import {existsSync} from "node:fs";
      test("journal conservado al arrancar",()=>expect(existsSync("test-results/scopes/marker.scope.json")).toBe(true));
    `,
    );
    const result = Bun.spawnSync(
      [
        process.execPath,
        resolve("node_modules/playwright/cli.js"),
        "test",
        "--config",
        join(directory, "playwright.config.ts"),
      ],
      {
        cwd: directory,
        env: { PATH: process.env.PATH ?? "" },
        stdout: "pipe",
        stderr: "pipe",
        timeout: 20000,
      },
    );
    expect(result.exitCode, result.stdout.toString() + result.stderr.toString()).toBe(0);
    expect(existsSync(journal)).toBe(true);
    expect(existsSync(environment)).toBe(true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 25000);

test("las pantallas sin backend no heredan las claves públicas de desarrollo", () => {
  const result = loadPlaywrightConfig({
    EXPO_PUBLIC_SUPABASE_URL: "https://development.test",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "development-key",
  });
  const config = JSON.parse(result.stdout.toString());
  expect(config.webServer.env.EXPO_PUBLIC_SUPABASE_URL).toBe("");
  expect(config.webServer.env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBe("");
});

for (const [key, value] of [
  ["TEST_SUPABASE_URL", "https://example.test:55321"],
  ["TEST_SUPABASE_PROJECT_ID", "diklass"],
  ["TEST_DATABASE_URL", "postgresql://postgres:secret@example.test:55322/postgres"],
  ["E2E_WEB_PORT", "0"],
] as const) {
  test(`rechaza un destino inseguro o incompatible: ${key}`, () => {
    expect(loadPlaywrightConfig({ ...testEnv, [key]: value }).exitCode).not.toBe(0);
  });
}

describe("configuración compartida de testing", () => {
  test("ignora desarrollo si ninguna variable de testing está presente", () => {
    expect(
      resolveTestConfig({
        EXPO_PUBLIC_SUPABASE_URL: "https://development.test",
        SUPABASE_URL: "https://development.test",
        SUPABASE_SERVICE_ROLE_KEY: "private-development-key",
      }),
    ).toBeUndefined();
  });

  test("resuelve un destino explícito sin exigir la clave administrativa opcional", () => {
    expect(resolveTestConfig(testEnv)).toEqual({
      url: "http://127.0.0.1:55321",
      anonKey: "public-test-key",
      databaseUrl: "postgresql://postgres:private-test-password@localhost:55322/postgres",
      projectId: "diklass-test-unit",
      serviceRoleKey: undefined,
      webPort: 8083,
    });
  });

  test("devuelve la clave administrativa solo al consumidor privado", () => {
    expect(
      resolveTestConfig({ ...testEnv, TEST_SUPABASE_SERVICE_ROLE_KEY: "private-role" })
        ?.serviceRoleKey,
    ).toBe("private-role");
  });

  test("required y ambos opt-ins exigen TEST_* sin fallback", () => {
    expect(() => resolveTestConfig({}, true)).toThrow();
    expect(() => resolveTestConfig({ SUPABASE_LIVE_TESTS: "1" })).toThrow();
    expect(() => resolveTestConfig({ E2E_BACKEND: "1" })).toThrow();
    expect(() => resolveTestConfig({ TEST_SUPABASE_SERVICE_ROLE_KEY: "private-role" })).toThrow();
    for (const key of Object.keys(testEnv)) {
      expect(() => resolveTestConfig({ ...testEnv, [key]: "" })).toThrow();
    }
  });

  for (const [key, value] of [
    ["TEST_SUPABASE_URL", "http://localhost:0"],
    ["TEST_SUPABASE_URL", "http://localhost"],
    ["TEST_SUPABASE_URL", "https://localhost:55321"],
    ["TEST_SUPABASE_URL", "http://user:private-password@localhost:55321"],
    ["TEST_SUPABASE_URL", "http://localhost:55321/rest/v1"],
    ["TEST_SUPABASE_URL", "http://localhost:55321/?token=private"],
    ["TEST_SUPABASE_URL", "http://localhost:55321/#private"],
    ["TEST_DATABASE_URL", "postgresql://postgres:private-password@localhost:0/postgres"],
    ["TEST_DATABASE_URL", "postgresql://postgres@localhost:55322/postgres"],
    ["TEST_DATABASE_URL", "postgresql://postgres:private-password@localhost/postgres"],
    ["TEST_DATABASE_URL", "postgresql://postgres:private-password@localhost:55322/"],
    ["TEST_DATABASE_URL", "https://postgres:private-password@localhost:55322/postgres"],
    ["TEST_DATABASE_URL", "private-password"],
    ["TEST_SUPABASE_PROJECT_ID", "diklass-demo"],
  ] as const) {
    test(`rechaza ${key} inválida sin revelar su contenido (${value.split(":")[0]})`, () => {
      let error: unknown;
      try {
        resolveTestConfig({ ...testEnv, [key]: value });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain("private-password");
      expect(String(error)).not.toContain(value);
    });
  }

  for (const port of ["", "0", "65536", "8083.5", "1e3", " 8083", "oops"]) {
    test(`rechaza puerto web inválido ${JSON.stringify(port)}`, () => {
      expect(() => resolveWebConfig({ E2E_WEB_PORT: port })).toThrow();
    });
  }

  test("admite puertos límite y una base URL local coherente", () => {
    expect(resolveWebConfig({ E2E_WEB_PORT: "1" }).baseURL).toBe("http://127.0.0.1:1");
    expect(
      resolveWebConfig({ E2E_WEB_PORT: "65535", PLAYWRIGHT_BASE_URL: "http://localhost:65535/" })
        .baseURL,
    ).toBe("http://localhost:65535/");
  });

  for (const baseURL of [
    "http://localhost:8084",
    "http://localhost:8083/path",
    "http://user:private-password@localhost:8083",
    "http://localhost:8083/?query=1",
  ]) {
    test(`rechaza baseURL incompatible ${new URL(baseURL).pathname}`, () => {
      expect(() => resolveWebConfig({ PLAYWRIGHT_BASE_URL: baseURL })).toThrow();
    });
  }
});

test("el script respeta E2E_WEB_PORT y da prioridad al argumento en ambos servidores", () => {
  const bin = mkdtempSync(join(tmpdir(), "diklass-web-port-"));
  try {
    // Solo sustituimos la exportación/servidor costosos; ejecutamos el script real.
    writeFileSync(join(bin, "bunx"), "#!/bin/sh\nexit 0\n");
    writeFileSync(join(bin, "bun"), '#!/bin/sh\nprintf "%s\\n" "$@"\n');
    chmodSync(join(bin, "bunx"), 0o755);
    chmodSync(join(bin, "bun"), 0o755);
    for (const devServer of ["", "1"]) {
      const env = { PATH: bin, E2E_WEB_PORT: "9183", E2E_DEV_SERVER: devServer };
      const inherited = Bun.spawnSync(["/bin/sh", "scripts/e2e-web-server.sh"], { env });
      expect(inherited.exitCode).toBe(0);
      expect(inherited.stdout.toString().trim().split("\n").at(-1)).toBe("9183");
      const argument = Bun.spawnSync(["/bin/sh", "scripts/e2e-web-server.sh", "9283"], { env });
      expect(argument.exitCode).toBe(0);
      expect(argument.stdout.toString().trim().split("\n").at(-1)).toBe("9283");
    }
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
});
