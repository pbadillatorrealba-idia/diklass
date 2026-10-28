import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { verifyContracts } from "../../../scripts/demo/contratos-demo";

let root: string;
const manifest = {
  revision: {
    reason: "Revisión compatible de FR-131: conserva los ejemplos del dataset.",
    requirements: ["FR-131"],
  },
  paths: ["contratos", "specs/spec.md"],
  sha256: {
    "contratos/schema.ts": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    "specs/spec.md": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
  },
};
function write(path: string, content: string) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
function save(value: unknown = manifest) {
  write("scripts/demo/contratos-demo.json", JSON.stringify(value));
}
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "contratos-demo-"));
  write("contratos/schema.ts", "a");
  write("specs/spec.md", "a");
  save();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("vigencia de contratos del demo, FR-131", () => {
  test("acepta revisión motivada en checkout sin PDF ni credenciales", () => {
    expect(() => verifyContracts(root)).not.toThrow();
    write("data/docs/formulario.pdf", "PDF modificado que no se debe verificar");
    expect(() => verifyContracts(root)).not.toThrow();
  });
  test.each(["contratos/schema.ts", "specs/spec.md"])(
    "detecta contenido cambiado en %s",
    (path) => {
      write(path, "nuevo contrato");
      expect(() => verifyContracts(root)).toThrow(path);
    },
  );
  test("detecta alta de archivo sin huella registrada", () => {
    write("contratos/nuevo.ts", "a");
    expect(() => verifyContracts(root)).toThrow("contratos/nuevo.ts");
  });
  test("detecta baja de archivo aunque desaparezca el directorio vigilado", () => {
    rmSync(join(root, "contratos"), { recursive: true });
    expect(() => verifyContracts(root)).toThrow("contratos/schema.ts");
  });
  test("detecta una spec individual eliminada", () => {
    unlinkSync(join(root, "specs/spec.md"));
    expect(() => verifyContracts(root)).toThrow("specs/spec.md");
  });
  test("renovar huellas sin motivo no permite acreditar vigencia", () => {
    save({ ...manifest, revision: { ...manifest.revision, reason: "  " } });
    expect(() => verifyContracts(root)).toThrow("motivo");
  });
  test("exige los requisitos afectados por la revisión", () => {
    save({ ...manifest, revision: { ...manifest.revision, requirements: [] } });
    expect(() => verifyContracts(root)).toThrow("requisitos");
  });
  test("rechaza inventario vacío en lugar de aprobar sin comprobar contratos", () => {
    save({ ...manifest, paths: [], sha256: {} });
    expect(() => verifyContracts(root)).toThrow("inventario");
  });
});
