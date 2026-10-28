import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

export const TEST_PROJECT_ID = "diklass-testing";
const workdir = resolve("test-results/backend");

export function prepareBackendConfiguration(source: string): string {
  let text = source.replace(/^project_id\s*=.*$/m, `project_id = "${TEST_PROJECT_ID}"`);
  const changeSection = (section: string, values: Record<string, number>) => {
    const expression = new RegExp(
      `(^\\[${section}\\]\\s*\\n)([\\s\\S]*?)(?=^\\[|$(?![\\s\\S]))`,
      "m",
    );
    const match = expression.exec(text);
    let body = match?.[2] ?? "";
    for (const [key, value] of Object.entries(values)) {
      const keyPattern = new RegExp(`^${key}\\s*=.*$`, "m");
      body = keyPattern.test(body)
        ? body.replace(keyPattern, `${key} = ${value}`)
        : `${key} = ${value}\n${body}`;
    }
    text = match ? text.replace(expression, `$1${body}`) : `${text}\n[${section}]\n${body}`;
  };
  changeSection("api", { port: 55321 });
  changeSection("db", { port: 55322, shadow_port: 55320 });
  changeSection("edge_runtime", { inspector_port: 55383 });
  return text;
}
async function capture(command: string[]): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
  const [output] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (await child.exited)
    throw new Error(
      `Falló ${command[0]} ${command[1] ?? ""}; no se imprimen las credenciales del comando.`,
    );
  return output;
}
export async function testBackend(action: "start" | "stop"): Promise<void> {
  if (action === "stop") {
    await capture(["supabase", "stop", "--project-id", TEST_PROJECT_ID]);
    console.info("Backend de testing detenido; volúmenes conservados.");
    return;
  }
  const names = (await capture(["docker", "ps", "--format", "{{.Names}}"])).trim().split("\n");
  if (names.some((name) => name.startsWith("supabase_") && !name.endsWith(`_${TEST_PROJECT_ID}`)))
    throw new Error(
      "Hay otro stack Supabase activo. Deténlo expresamente antes de iniciar testing.",
    );
  const directory = resolve(workdir, "supabase");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(
    resolve(directory, "config.toml"),
    prepareBackendConfiguration(readFileSync("supabase/config.toml", "utf8")),
  );
  for (const entry of ["migrations", "seed.sql", "functions", "tests"]) {
    const source = resolve("supabase", entry);
    const target = resolve(directory, entry);
    if (existsSync(source) && !existsSync(target)) symlinkSync(source, target);
  }
  await capture([
    "supabase",
    "start",
    "--workdir",
    workdir,
    "-x",
    "realtime,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor",
  ]);
  const status = await capture(["supabase", "status", "--workdir", workdir, "-o", "env"]);
  const variables = Object.fromEntries(
    status.split("\n").flatMap((line) => {
      const match = /^([A-Z_]+)="([^"\r\n]*)"$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  const mapped: Record<string, string | undefined> = {
    TEST_SUPABASE_PROJECT_ID: TEST_PROJECT_ID,
    TEST_SUPABASE_URL: variables.API_URL,
    TEST_SUPABASE_ANON_KEY: variables.ANON_KEY,
    TEST_DATABASE_URL: variables.DB_URL,
    TEST_SUPABASE_SERVICE_ROLE_KEY: variables.SERVICE_ROLE_KEY,
  };
  if (Object.values(mapped).some((value) => !value))
    throw new Error("El CLI no devolvió la configuración completa de testing.");
  const path = resolve("test-results/backend.env");
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  writeFileSync(
    temporary,
    `${Object.entries(mapped)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n")}\n`,
    { mode: 0o600, flag: "wx" },
  );
  renameSync(temporary, path);
  console.info("Backend de testing preparado; configuración privada en test-results/backend.env.");
}
if (import.meta.main) {
  const action = process.argv[2];
  if (action !== "start" && action !== "stop")
    throw new Error("Uso: bun scripts/test-backend.ts start|stop");
  await testBackend(action);
}
