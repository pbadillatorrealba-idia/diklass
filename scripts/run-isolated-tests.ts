import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { resolveTestConfig, resolveWebConfig, type TestConfig } from "../tests/support/test-config";
import { recoverTestScope, verifyTestBackend, withTestScope } from "../tests/support/test-scope";

type Suite = "integration" | "web";
export function testCommand(suite: Suite, file: string, options: string[] = []): string[] {
  const root = suite === "integration" ? "tests/integration/" : "tests/e2e/web/";
  const extension = suite === "integration" ? ".test.ts" : ".spec.ts";
  if (!file.includes("/")) file = `${root}${file}`;
  if (
    options.some((option) => !/^--project=(chromium|chromium-dark|firefox|webkit)$/.test(option)) ||
    (suite === "integration" && options.length)
  )
    throw new Error("Opción de test no admitida.");
  if (
    !file.startsWith(root) ||
    !file.endsWith(extension) ||
    file.includes("..") ||
    !existsSync(file)
  )
    throw new Error("Se requiere un archivo de test dentro de la suite seleccionada.");
  return suite === "integration"
    ? ["bun", "test", file]
    : ["bunx", "playwright", "test", file, "--workers=1", ...options];
}

async function startWebServer(config: TestConfig) {
  await verifyTestBackend(config);
  const { baseURL } = resolveWebConfig(process.env);
  let occupied = false;
  try {
    await fetch(baseURL, { signal: AbortSignal.timeout(1000) });
    occupied = true;
  } catch {
    /* Puerto sin servidor HTTP. */
  }
  if (occupied)
    throw new Error("El puerto web está ocupado; no se reutiliza un servidor de otro destino.");
  const server = Bun.spawn(["sh", "scripts/e2e-web-server.sh", String(config.webPort)], {
    env: {
      ...process.env,
      EXPO_PUBLIC_SUPABASE_URL: config.url,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: config.anonKey,
      EXPO_NO_DOTENV: "1",
      E2E_CLEAR_CACHE: "1",
    },
    stdout: "inherit",
    stderr: "inherit",
    stdin: "ignore",
  });
  const deadline = Date.now() + 240_000;
  try {
    while (Date.now() < deadline) {
      if (server.exitCode !== null)
        throw new Error("El servidor web terminó antes de estar disponible.");
      try {
        if ((await fetch(baseURL, { signal: AbortSignal.timeout(1000) })).ok) return server;
      } catch {
        /* Esperar exportación. */
      }
      await Bun.sleep(500);
    }
    throw new Error("El servidor web no estuvo disponible en 240 segundos.");
  } catch (error) {
    server.kill();
    throw error;
  }
}

export async function runIsolatedTests(
  suite: Suite,
  files: string[],
  options: string[] = [],
): Promise<number> {
  const config = resolveTestConfig(process.env, true);
  if (!config) throw new Error("Configuración de testing obligatoria.");
  // Validar todos los argumentos antes del primer provisioning.
  const commands = files.map((file) => testCommand(suite, file, options));
  if (!commands.length) throw new Error("No hay archivos de prueba seleccionados.");
  const server = suite === "web" ? await startWebServer(config) : undefined;
  try {
    for (const [index, command] of commands.entries()) {
      const exitCode = await withTestScope(config, files[index] as string, async (env) => {
        const child = Bun.spawn(command, {
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
          env: {
            ...process.env,
            ...env,
            SUPABASE_LIVE_TESTS: "1",
            ...(suite === "web" ? { E2E_BACKEND: "1", TEST_WEB_SERVER_READY: "1" } : {}),
          },
        });
        const interrupted = () => child.kill("SIGTERM");
        process.on("SIGINT", interrupted);
        process.on("SIGTERM", interrupted);
        try {
          return await child.exited;
        } finally {
          process.off("SIGINT", interrupted);
          process.off("SIGTERM", interrupted);
        }
      });
      if (exitCode) return exitCode;
    }
    return 0;
  } finally {
    if (server) server.kill();
  }
}
if (import.meta.main) {
  const [suite, ...requested] = process.argv.slice(2);
  if (suite === "recover") {
    const path = requested[0];
    const config = resolveTestConfig(process.env, true);
    if (!path || requested.length !== 1 || !config)
      throw new Error("Uso: bun scripts/run-isolated-tests.ts recover <scope.json>");
    await recoverTestScope(config, resolve(path));
  } else {
    if (suite !== "integration" && suite !== "web")
      throw new Error(
        "Uso: bun scripts/run-isolated-tests.ts integration|web [archivos] | recover <scope.json>",
      );
    const pattern =
      suite === "integration" ? "tests/integration/**/*.test.ts" : "tests/e2e/web/**/*.spec.ts";
    const options = requested.filter((arg) => arg.startsWith("--project="));
    const paths = requested.filter((arg) => arg !== "--" && !arg.startsWith("--project="));
    const files = paths.length
      ? paths
      : [...new Bun.Glob(pattern).scanSync(".")]
          .filter((file) => file !== "tests/integration/testing/test-scope.test.ts")
          .sort();
    process.exitCode = await runIsolatedTests(suite, files, options);
  }
}
