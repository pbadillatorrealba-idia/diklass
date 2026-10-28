import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync } from "node:fs";
import { demoManifestPath } from "./demo/cargar-demo";
import { isLocalSupabaseUrl, parseArgs } from "./lib/provisioning";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const manifestIndex = args.indexOf("--manifest");
let customPath: string | undefined;
if (manifestIndex >= 0) {
  customPath = args[manifestIndex + 1];
  if (!customPath || customPath.startsWith("--")) throw new Error("--manifest requiere una ruta.");
  args.splice(manifestIndex, 2);
}
const { fixturePath, allowRemote } = parseArgs(args);
const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
if (!url || !isLocalSupabaseUrl(url) || allowRemote)
  throw new Error("demo:reset exige un destino local explícito.");
const status = JSON.parse(
  execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }),
);
if (new URL(status.API_URL).origin !== new URL(url).origin)
  throw new Error("El CLI y el entorno apuntan a destinos distintos; no se reinicia.");
const manifest = demoManifestPath(url, customPath);
if (
  existsSync(manifest) &&
  JSON.parse(readFileSync(manifest, "utf8")).target !== new URL(url).origin
) {
  throw new Error("El manifiesto corresponde a otro destino; no se reinicia.");
}
console.warn(
  "DEMO: reset explícito de TODA la base local identificada; conserva los manifiestos anteriores como archivo.",
);
execFileSync("supabase", ["db", "reset", "--local"], { stdio: "inherit" });
if (existsSync(manifest)) renameSync(manifest, `${manifest}.before-reset-${Date.now()}`);
execFileSync(process.execPath, ["scripts/provision-veterinarians.ts", "--fixture", fixturePath], {
  stdio: "inherit",
});
execFileSync(
  process.execPath,
  ["scripts/provision-demo-data.ts", "--fixture", fixturePath, "--manifest", manifest],
  { stdio: "inherit" },
);
