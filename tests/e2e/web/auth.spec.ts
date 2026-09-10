import { expect, test } from "@playwright/test";

test.describe("auth web shell", () => {
  test("shows the accessible login without a registration path", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Diklass" })).toBeVisible();
    await expect(page.getByLabel("Correo de acceso")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByText(/registr/i)).toHaveCount(0);
  });

  test("uses client-side validation before any credential request", async ({ page }) => {
    await page.goto("/login");
    const submit = page.getByRole("button", { name: "Iniciar sesión" });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByTestId("login-error")).toHaveText(
      "Revisa los campos marcados antes de continuar.",
    );
  });

  test("denies a direct protected route without an authenticated session", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login$/);
  });
});
