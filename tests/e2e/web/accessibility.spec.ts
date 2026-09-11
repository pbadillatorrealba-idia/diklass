import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ANA, expect, hasBackend, submitLogin, test } from "./fixtures";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  expect(
    violations.map(({ id, help, nodes }) => ({
      id,
      help,
      nodes: nodes.map((node) => ({ target: node.target, why: node.failureSummary })),
    })),
  ).toEqual([]);
}

test.describe("WCAG 2.2 AA gate", () => {
  test("the login screen has no automatically detectable violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    await expectNoViolations(page);
  });

  test("the login error state has no automatically detectable violations", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByTestId("login-error")).toBeVisible();
    await expectNoViolations(page);
  });

  test("the protected screens have no automatically detectable violations", async ({ page }) => {
    test.skip(!hasBackend, "Requires local Supabase with the synthetic veterinarians provisioned.");
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    await expect(page.getByTestId("authenticated-identity")).toBeVisible();
    await expectNoViolations(page);

    await page.goto(`/consultations/${crypto.randomUUID()}`);
    await expect(page.getByLabel("Notas de la consulta")).toBeVisible();
    await expectNoViolations(page);
  });
});
