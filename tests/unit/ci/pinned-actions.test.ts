import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS = ".github/workflows";
const workflows = readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name));

// plan.md (CI de GitHub) requires every third-party action pinned by commit SHA.
describe("GitHub Actions supply chain", () => {
  test.each(workflows)("%s pins every action by commit SHA", (name) => {
    const text = readFileSync(join(WORKFLOWS, name), "utf8");
    const refs = [...text.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatch(/@[0-9a-f]{40}$/);
    }
  });

  test.each(workflows)("%s never installs the Supabase CLI as 'latest'", (name) => {
    expect(readFileSync(join(WORKFLOWS, name), "utf8")).not.toMatch(/version:\s*latest/);
  });
});
