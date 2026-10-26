import { provisionClinicalCase, type SyntheticCase } from "./caso-sintetico";
import { ANA, expect, hasBackend, submitLogin, test } from "./fixtures";

// sistema-visual US14 (design.md D12): navegación global adaptable, con barra lateral a partir de
// 1024 px y pestañas inferiores por debajo, y retroceso explícito en las pantallas de detalle.
test.describe("navegación global adaptable (FR-082 · FR-083 · SC-054)", () => {
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");

  let caso: SyntheticCase = { patientId: "", openConsultationId: "", closedConsultationId: "" };

  test.beforeAll(async ({ browser }) => {
    caso = await provisionClinicalCase(browser);
  });

  test.beforeEach(async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  });

  test("a 1280 px, la barra lateral marca la sección actual y ofrece cerrar sesión", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/patients");
    const sidebar = page.getByTestId("app-sidebar");
    await expect(sidebar).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("app-tabbar")).toBeHidden();

    for (const name of ["Inicio", "Pacientes", "Seguimiento", "Conocimiento"]) {
      await expect(sidebar.getByRole("link", { name })).toBeVisible();
    }
    await expect(sidebar.getByRole("link", { name: "Pacientes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(sidebar.getByRole("link", { name: "Conocimiento" })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(sidebar.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();
  });

  test("el primer elemento enfocable es «Saltar al contenido» y lleva el foco al contenido", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/patients");
    await expect(page.getByTestId("patients-list")).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#contenido")).toBeFocused();
  });

  test("a 375 px, la barra de pestañas da acceso a las cuatro secciones", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/knowledge");
    const tabbar = page.getByTestId("app-tabbar");
    await expect(tabbar).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("app-sidebar")).toBeHidden();
    for (const name of ["Inicio", "Pacientes", "Seguimiento", "Conocimiento"]) {
      await expect(tabbar.getByRole("link", { name })).toBeVisible();
    }
    await expect(tabbar.getByRole("link", { name: "Conocimiento" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  for (const [width, testID] of [
    [1280, "app-sidebar"],
    [375, "app-tabbar"],
  ] as const) {
    test(`a ${width} px, desde una consulta se llega a Seguimiento en 1 activación`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/consultations/${caso.openConsultationId}`);
      await expect(page.getByTestId("anamnesis-section")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId(testID).getByRole("link", { name: "Seguimiento" }).click();
      await expect(page).toHaveURL(/\/follow-up$/);
      await expect(page.getByTestId("follow-up-patient-list")).toBeVisible({ timeout: 15_000 });
    });
  }

  test("a 1280 px, la consulta muestra el breadcrumb Pacientes › ficha y a 375 px solo «Volver»", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/consultations/${caso.openConsultationId}`);
    const ruta = page.getByRole("navigation", { name: "Ruta" });
    await expect(ruta).toBeVisible({ timeout: 15_000 });
    await expect(ruta.getByTestId("screen-crumb-0")).toHaveText("Pacientes");
    await expect(ruta.getByTestId("screen-back")).toHaveText(/\S/);
    await expect(ruta.locator('[aria-current="page"]')).toBeVisible();
    await ruta.getByTestId("screen-back").click();
    await expect(page).toHaveURL(new RegExp(`/patients/${caso.patientId}$`));

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(`/consultations/${caso.openConsultationId}`);
    const volver = page.getByTestId("screen-back").filter({ visible: true });
    await expect(volver).toBeVisible({ timeout: 15_000 });
    await expect(volver).toContainText("Volver");
    await expect(page.getByRole("navigation", { name: "Ruta" })).toHaveCount(0);
  });

  test("«Volver» en un detalle abierto por URL directa lleva a la raíz de su sección", async ({
    page,
  }) => {
    await page.goto(`/follow-up/${caso.patientId}`);
    await expect(page.getByTestId("feedback-antecedents")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("screen-back").filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/follow-up$/);
  });
});
