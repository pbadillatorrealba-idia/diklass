import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS = ".github/workflows";
const workflows = readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name));

// plan.md (CI de GitHub) requires every third-party action pinned by commit SHA.
describe("GitHub Actions supply chain", () => {
  // test.each(workflows) registers zero tests -- and the suite reports green -- if
  // .github/workflows is ever renamed, moved or emptied. Guard the precondition directly.
  test("the workflows directory is not empty and holds the expected files", () => {
    expect(workflows.length).toBeGreaterThan(0);
    expect(workflows).toContain("ci.yml");
    expect(workflows).toContain("native-e2e.yml");
  });

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
