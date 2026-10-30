import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkSkills, normalize } from "../../../scripts/check-skills";

let root: string;
function put(base: ".claude" | ".agents", path: string, content: string) {
  const file = join(root, base, "skills", path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
const skill = (invoke: string, body = "Cuerpo.") =>
  `---\nname: demo\ndescription: Demo\n---\nUsa ${invoke} demo. ${body}\n`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "check-skills-"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("normalize", () => {
  test("reduce las invocaciones de Codex y las rutas del espejo a la forma de Claude", () => {
    expect(normalize("$impeccable audit en .agents/skills/impeccable", ["impeccable"])).toBe(
      "/impeccable audit en .claude/skills/impeccable",
    );
    expect(
      normalize("`$openspec-apply-change (Codex) or /openspec-apply-change (other agents)`", []),
    ).toBe("`/openspec-apply-change`");
  });
});

describe("checkSkills", () => {
  test("un espejo que solo difiere en la invocación no tiene hallazgos", () => {
    put(".claude", "demo/SKILL.md", skill("/demo"));
    put(".agents", "demo/SKILL.md", skill("$demo"));
    expect(checkSkills(root)).toEqual([]);
  });

  test("las skills que genera su herramienta (openspec-*, impeccable) solo vigilan nombre y descripción", () => {
    put(".claude", "openspec-demo/SKILL.md", skill("/openspec-demo", "Texto de Claude."));
    put(".agents", "openspec-demo/SKILL.md", skill("$openspec-demo", "Texto de Codex."));
    expect(checkSkills(root)).toEqual([]);
  });

  test("ignora los archivos de agents/ de una skill generada: son propios de cada harness", () => {
    put(".claude", "impeccable/SKILL.md", skill("/impeccable"));
    put(".agents", "impeccable/SKILL.md", skill("$impeccable"));
    put(".agents", "impeccable/agents/openai.yaml", "x");
    expect(checkSkills(root)).toEqual([]);
  });

  test("informa de una skill ausente en el espejo", () => {
    put(".claude", "demo/SKILL.md", skill("/demo"));
    expect(checkSkills(root)).toEqual(["demo: falta en .agents/skills"]);
  });

  test("informa de un archivo ausente y de contenido que diverge", () => {
    put(".claude", "demo/SKILL.md", skill("/demo"));
    put(".claude", "demo/extra.md", "x");
    put(".agents", "demo/SKILL.md", skill("$demo", "Otro cuerpo."));
    expect(checkSkills(root)).toEqual([
      "demo/SKILL.md: contenido distinto",
      "demo/extra.md: falta en .agents/skills",
    ]);
  });
});
