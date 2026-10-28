import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { demoManifestPath, loadDemo } from "./demo/cargar-demo";
import { parseArgs } from "./lib/provisioning";

const args = process.argv.slice(2);
let manifestPath: string | undefined;
const manifestIndex = args.indexOf("--manifest");
if (manifestIndex >= 0) {
  manifestPath = args[manifestIndex + 1];
  if (!manifestPath || manifestPath.startsWith("--"))
    throw new Error("--manifest requiere una ruta.");
  args.splice(manifestIndex, 2);
}
const { fixturePath, allowRemote } = parseArgs(args);
const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey)
  throw new Error("SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY son obligatorios.");
const fixtures: unknown = JSON.parse(await readFile(fixturePath, "utf8"));
const result = await loadDemo({
  url,
  anonKey,
  fixtures,
  allowRemote,
  manifestPath: demoManifestPath(url, manifestPath),
  revision: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
});
console.info(
  result.reused
    ? "Dataset completo verificado; sin nuevas escrituras clínicas."
    : "Clínica de demostración cargada: 15 tutores, 25 pacientes y 8 consultas; 3 cerradas, 6 evoluciones.",
);
