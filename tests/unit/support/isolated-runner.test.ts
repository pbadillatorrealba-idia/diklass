import { expect, test } from "bun:test";
import { testCommand } from "../../../scripts/run-isolated-tests";

test("el runner conserva la matriz de navegadores definida por Playwright", () => {
  expect(testCommand("web", "tests/e2e/web/auth.spec.ts")).not.toContain("--project=chromium");
});

test("mantiene selección de navegador y nombres cortos de archivos existentes", () => {
  expect(testCommand("web", "auth.spec.ts", ["--project=chromium"])).toEqual([
    "bunx",
    "playwright",
    "test",
    "tests/e2e/web/auth.spec.ts",
    "--workers=1",
    "--project=chromium",
  ]);
});
