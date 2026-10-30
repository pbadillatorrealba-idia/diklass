// Comprueba que `.agents/skills/` (espejo para Codex y Oh My Pi) siga a `.claude/skills/` (fuente).
// Solo se admiten las diferencias de invocación (`/x` frente a `$x`) y de ruta; lo demás es deriva.
// Uso: `bun run check:skills`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export function normalize(text: string, skills: string[]): string {
  return text
    .replace(/\.agents\/skills/g, ".claude/skills")
    .replace(/\$([a-z][\w-]*) \(Codex\) or \/\1 \(other agents\)/g, "/$1")
    .replace(new RegExp(`\\$(${skills.join("|")})(?![\\w-])`, "g"), "/$1");
}

// openspec e impeccable regeneran cada espejo con su propia herramienta (el texto cambia con el
// harness: herramienta de preguntas, skills opcionales).
// shortcut: de ellas solo se vigilan archivos, nombre y descripción, regenerar si el cuerpo importa
const GENERATED = /^(openspec-|impeccable$)/;

// El front-matter de impeccable difiere por harness (user-invocable, metadata...): solo se
// compara lo que decide la invocación.
// shortcut: el resto del front-matter no se vigila, comparar más claves si deriva
function split(text: string): { head: string; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { head: "", body: text };
  const keep = (k: string) => m[1].match(new RegExp(`^${k}: .*$`, "m"))?.[0] ?? "";
  return { head: `${keep("name")}|${keep("description")}`, body: m[2] };
}

// `agents/` de una skill generada trae los subagentes propios de cada harness (.toml de Codex...).
function files(dir: string, generated: boolean): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((f) => statSync(join(dir, f)).isFile() && !(generated && f.startsWith("agents/")))
    .sort();
}

function same(a: string, b: string, skills: string[], generated: boolean): boolean {
  const [x, y] = [readFileSync(a), readFileSync(b)];
  if (x.equals(y)) return true;
  const [sx, sy] = [split(normalize(x.toString(), skills)), split(normalize(y.toString(), skills))];
  return sx.head === sy.head && (generated || sx.body === sy.body);
}

export function checkSkills(root: string): string[] {
  const src = join(root, ".claude/skills");
  const mirror = join(root, ".agents/skills");
  const names = (d: string) => (existsSync(d) ? readdirSync(d).sort() : []);
  const skills = [...new Set([...names(src), ...names(mirror)])];
  const problems: string[] = [];
  for (const name of skills) {
    const [a, b] = [join(src, name), join(mirror, name)];
    if (!existsSync(b)) problems.push(`${name}: falta en .agents/skills`);
    else if (!existsSync(a)) problems.push(`${name}: falta en .claude/skills`);
    else {
      const generated = GENERATED.test(name);
      const [fa, fb] = [files(a, generated), files(b, generated)];
      for (const f of new Set([...fa, ...fb].sort())) {
        if (!fb.includes(f)) problems.push(`${name}/${f}: falta en .agents/skills`);
        else if (!fa.includes(f)) problems.push(`${name}/${f}: falta en .claude/skills`);
        else if (!same(join(a, f), join(b, f), skills, generated))
          problems.push(`${name}/${f}: contenido distinto`);
      }
    }
  }
  return problems;
}

if (import.meta.main) {
  const problems = checkSkills(process.cwd());
  for (const p of problems) console.error(p);
  if (problems.length) process.exit(1);
  console.log("Espejo de skills sincronizado.");
}
