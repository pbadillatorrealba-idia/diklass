import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const manifestPath = "scripts/demo/contratos-demo.json";

function safePath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    /^[\w.-]+(?:\/[\w.-]+)*$/.test(path) &&
    !path.split("/").some((part) => part === "." || part === "..") &&
    !path.startsWith("data/") &&
    !/\.pdf$/i.test(path)
  );
}

/** FR-131: huellas e inventario; la cobertura y aceptación se verifican por separado. */
export function verifyContracts(root = resolve(import.meta.dir, "../..")): void {
  const manifest = JSON.parse(readFileSync(join(root, manifestPath), "utf8"));
  if (typeof manifest?.revision?.reason !== "string" || !manifest.revision.reason.trim()) {
    throw new Error(`${manifestPath}: la revisión exige un motivo explícito.`);
  }
  if (
    !Array.isArray(manifest.revision.requirements) ||
    !manifest.revision.requirements.length ||
    !manifest.revision.requirements.every(
      (value: unknown) => typeof value === "string" && /^FR-\d+$/.test(value),
    )
  ) {
    throw new Error(`${manifestPath}: indicar los requisitos afectados por la revisión.`);
  }
  if (
    !Array.isArray(manifest.paths) ||
    !manifest.paths.length ||
    !manifest.paths.every(safePath) ||
    !manifest.sha256 ||
    typeof manifest.sha256 !== "object" ||
    Array.isArray(manifest.sha256) ||
    !Object.keys(manifest.sha256).length ||
    !Object.entries(manifest.sha256).every(
      ([path, hash]) => safePath(path) && typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash),
    )
  ) {
    throw new Error(
      `${manifestPath}: inventario o huellas inválidos; no se admiten rutas PDF ni data/.`,
    );
  }

  const current = new Map<string, string>();
  function visit(path: string) {
    if (!safePath(path)) {
      throw new Error(`Ruta vigilada no admitida: ${path}`);
    }
    const absolute = join(root, path);
    if (!existsSync(absolute)) return;
    const stat = lstatSync(absolute);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(absolute).sort()) visit(`${path}/${entry}`);
    } else if (stat.isFile()) {
      current.set(path, createHash("sha256").update(readFileSync(absolute)).digest("hex"));
    } else {
      throw new Error(`Contrato vigilado debe ser un archivo o directorio: ${path}`);
    }
  }
  for (const path of manifest.paths) visit(path);
  const expected: Record<string, string> = manifest.sha256;
  const affected = [...new Set([...Object.keys(expected), ...current.keys()])]
    .filter((path) => expected[path] !== current.get(path))
    .sort();
  if (affected.length) {
    throw new Error(
      `Contratos del demo desactualizados (FR-131):\n${affected.join("\n")}\nRevisar dataset, cobertura y pruebas; registrar motivo y requisitos antes de renovar huellas. Renovarlas no acredita cobertura ni aceptación clínica.`,
    );
  }
}

if (import.meta.main) {
  try {
    verifyContracts();
    console.log(
      "Huellas e inventario del demo vigentes; cobertura y aceptación requieren controles separados.",
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
