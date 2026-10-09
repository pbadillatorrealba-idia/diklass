import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ANA, expect, hasBackend, submitLogin, test } from "./fixtures";

/** perfil-profesional (FR-095 · FR-096): el nombre visible se edita, se audita y se ve al instante. */
test.describe("perfil profesional", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasBackend, "Requires a local Supabase instance with vet.ana@example.test.");
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    await page.goto("/settings");
    await page.getByTestId("settings-edit-profile").click();
    await expect(page.getByTestId("profile-screen")).toBeVisible();
  });

  async function guardar(page: Page, nombre: string) {
    const campo = page.getByTestId("profile-display-name");
    await campo.fill(nombre);
    await page.getByTestId("profile-save").click();
  }

  test("cambia el nombre, se ve en la barra sin recargar y queda en el historial", async ({
    page,
  }) => {
    const nuevo = `Dra. Ana Perfil ${Date.now() % 100000}`;
    try {
      await guardar(page, nuevo);
      await expect(page.getByTestId("profile-status")).toContainText("Nombre actualizado");
      await expect(page.getByTestId("profile-history")).toContainText(
        `${ANA.displayName} → ${nuevo}`,
      );
      await expect(page.getByTestId("account-link").first()).toHaveAttribute(
        "aria-label",
        `Configuración de ${nuevo}`,
      );
    } finally {
      // Otras suites buscan «Dra. Ana Torres» (tasks 2.3).
      await guardar(page, ANA.displayName);
      await expect(page.getByTestId("profile-history")).toContainText(`→ ${ANA.displayName}`);
    }
  });

  test("valida el nombre antes de enviarlo y conserva lo escrito", async ({ page }) => {
    await guardar(page, "A");
    await expect(page.getByText("al menos 2 caracteres")).toBeVisible();
    await expect(page.getByTestId("profile-display-name")).toHaveValue("A");
    await expect(page.getByTestId("profile-status")).toHaveCount(0);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`sin violaciones axe en tema ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude("#error-toast") // overlay de desarrollo de @expo/log-box
        .analyze();
      expect(
        violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((n) => n.target) })),
      ).toEqual([]);
    });
  }
});
