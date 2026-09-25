import AxeBuilder from "@axe-core/playwright";
import { ANA, expect, hasBackend, submitLogin, test } from "./fixtures";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// Canales de `--background` en `global.css`: el token que pinta el fondo de toda la app.
const DARK_BACKGROUND = "1 4 4";
const LIGHT_BACKGROUND = "238 242 241";

const background = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
  );

// sistema-visual US16 · FR-091 · FR-094 · SC-058 (design.md D17).
test.describe("tema manual, calendario de Inicio y Configuración", () => {
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");
  test.use({ colorScheme: "light" });

  test.beforeEach(async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  });

  test("el botón cambia a oscuro sin recargar, persiste y «Sistema» lo devuelve", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const toggle = page.getByTestId("app-sidebar").getByTestId("theme-toggle");
    await expect(toggle).toHaveAccessibleName("Cambiar a modo oscuro");
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(toggle).toHaveAccessibleName("Cambiar a modo claro");
    await expect.poll(() => background(page)).toBe(DARK_BACKGROUND);

    await page.reload();
    await expect(page.getByTestId("home-agenda")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => background(page)).toBe(DARK_BACKGROUND);
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(
      violations.filter((v) => !v.nodes.every((n) => String(n.target).includes("#error-toast"))),
    ).toEqual([]);

    await page.goto("/settings");
    await page.getByTestId("settings-theme").getByRole("radio", { name: "Sistema" }).click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await expect.poll(() => background(page)).toBe(LIGHT_BACKGROUND);
  });

  test("con la preferencia oscura, el primer pintado ya es oscuro (sin destello)", async ({
    page,
  }) => {
    await page.evaluate(() => localStorage.setItem("diklass.theme", "dark"));
    // Sin el bundle de JS solo actúa el script en línea de `+html.tsx`.
    await page.route("**/*.bundle*", (route) => route.abort());
    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("Inicio muestra el mes actual vacío, navegable, sin violaciones en claro y oscuro", async ({
    page,
  }) => {
    const agenda = page.getByTestId("home-agenda");
    await expect(agenda).toBeVisible({ timeout: 15_000 });
    await expect(agenda.getByTestId("calendar-empty")).toHaveText("Sin eventos agendados");
    const title = agenda.getByRole("heading", { level: 3 });
    const before = await title.textContent();
    await agenda.getByRole("button", { name: "Mes siguiente" }).click();
    await expect(title).not.toHaveText(before ?? "");
    await agenda.getByRole("button", { name: "Mes anterior" }).click();
    await expect(title).toHaveText(before ?? "");
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      expect(
        violations.filter((v) => !v.nodes.every((n) => String(n.target).includes("#error-toast"))),
        scheme,
      ).toEqual([]);
    }
  });

  for (const width of [1280, 375]) {
    test(`a ${width} px, Configuración queda a 1 activación desde una pantalla protegida`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/patients");
      await expect(page.getByTestId("patients-list")).toBeVisible({ timeout: 15_000 });
      const entry =
        width >= 1024
          ? page.getByTestId("app-sidebar").getByRole("link", { name: "Configuración" })
          : page.getByTestId("app-topbar").getByRole("link", { name: /Configuración/ });
      await entry.click();
      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.getByTestId("settings-profile")).toContainText(ANA.displayName);
    });
  }
});
