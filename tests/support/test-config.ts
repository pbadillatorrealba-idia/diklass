export type TestConfig = {
  url: string;
  anonKey: string;
  databaseUrl: string;
  serviceRoleKey?: string;
  projectId: string;
  webPort: number;
};

type Environment = Record<string, string | undefined>;

function localUrl(value: string, variable: string, protocol: string): URL {
  const invalid = () =>
    new Error(`${variable}: se requiere una URL ${protocol} local con puerto explícito.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalid();
  }
  const port = Number(/:(\d+)$/.exec(value.split("/")[2] ?? "")?.[1]);
  if (
    url.protocol !== `${protocol}:` ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    url.search ||
    url.hash
  ) {
    throw invalid();
  }
  return url;
}

export function resolveWebConfig(env: Environment): { webPort: number; baseURL: string } {
  const port = env.E2E_WEB_PORT ?? "8083";
  const webPort = Number(port);
  if (!/^\d+$/.test(port) || !Number.isInteger(webPort) || webPort < 1 || webPort > 65535) {
    throw new Error("E2E_WEB_PORT: se requiere un entero entre 1 y 65535.");
  }
  const baseURL = env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${webPort}`;
  const url = localUrl(baseURL, "PLAYWRIGHT_BASE_URL", "http");
  if (
    Number(url.port || "80") !== webPort ||
    url.username ||
    url.password ||
    url.pathname !== "/"
  ) {
    throw new Error("PLAYWRIGHT_BASE_URL debe corresponder al servidor local y E2E_WEB_PORT.");
  }
  return { webPort, baseURL };
}

export function resolveTestConfig(env: Environment, required = false): TestConfig | undefined {
  const { webPort } = resolveWebConfig(env);
  const variables = [
    "TEST_SUPABASE_URL",
    "TEST_SUPABASE_ANON_KEY",
    "TEST_DATABASE_URL",
    "TEST_SUPABASE_PROJECT_ID",
  ] as const;
  const requested = required || env.SUPABASE_LIVE_TESTS === "1" || env.E2E_BACKEND === "1";
  if (
    !requested &&
    ![...variables, "TEST_SUPABASE_SERVICE_ROLE_KEY"].some((key) => env[key] !== undefined)
  ) {
    return undefined;
  }
  const missing = variables.filter((key) => !env[key]?.trim());
  if (missing.length) {
    throw new Error(
      `Configuración de testing incompleta: faltan ${missing.join(", ")}. No se usan variables de desarrollo.`,
    );
  }
  const url = env.TEST_SUPABASE_URL as string;
  const anonKey = env.TEST_SUPABASE_ANON_KEY as string;
  const databaseUrl = env.TEST_DATABASE_URL as string;
  const projectId = env.TEST_SUPABASE_PROJECT_ID as string;
  const api = localUrl(url, "TEST_SUPABASE_URL", "http");
  if (api.username || api.password || api.pathname !== "/") {
    throw new Error("TEST_SUPABASE_URL debe ser la raíz del API local, sin credenciales.");
  }
  const database = localUrl(databaseUrl, "TEST_DATABASE_URL", "postgresql");
  if (
    !database.username ||
    !database.password ||
    !database.port ||
    database.pathname === "/" ||
    !database.pathname
  ) {
    throw new Error(
      "TEST_DATABASE_URL requiere usuario, contraseña, puerto y base de datos locales.",
    );
  }
  // Ambos hosts permitidos son loopback; el runner verifica la identidad real del proyecto.
  if (!/^diklass-test[a-z0-9-]*$/.test(projectId)) {
    throw new Error(
      "TEST_SUPABASE_PROJECT_ID debe identificar un proyecto diklass-test distinto de desarrollo.",
    );
  }
  return {
    url,
    anonKey,
    databaseUrl,
    serviceRoleKey: env.TEST_SUPABASE_SERVICE_ROLE_KEY || undefined,
    projectId,
    webPort,
  };
}
