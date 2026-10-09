import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { ANA, expect, SUPABASE_ANON_KEY, SUPABASE_URL, submitLogin, test } from "./fixtures";
import { prepararPaciente } from "./preparar-paciente";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function sinViolacionesAxe(page: Page) {
  // `#error-toast` es el overlay de desarrollo de Expo (ver accessibility.spec.ts).
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_22_AA)
    .exclude("#error-toast")
    .analyze();
  expect(violations.map((violation) => violation.id)).toEqual([]);
}

test.describe("ficha canina etológica (ficha-canina-etologia)", () => {
  test.beforeEach(() => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  // FR-001/FR-027/FR-110 ampliados: alta por la interfaz con los datos de la hoja.
  test("el alta guarda procedencia, derivante y datos del tutor, y la ficha los muestra", async ({
    page,
  }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    await page.goto("/patients/new");

    await page.getByTestId("patient-name").fill("Rocky E2E etología");
    await page.getByTestId("patient-species").fill("canino");
    await page.getByTestId("patient-breed").fill("Mestizo");
    await page.getByTestId("patient-sex").fill("macho");
    await page.getByTestId("patient-reproductive-status").fill("castrado");
    await page.getByTestId("patient-origin").fill("Protectora Sur");
    await page.getByTestId("patient-adoption-age").fill("4 meses");
    await page.getByTestId("patient-first-visit-date").fill("2026-09-01");
    await page.getByRole("radio", { name: "Sí", exact: true }).first().click();
    await page.getByTestId("patient-referrer-center").fill("Clínica Norte");

    await page.getByRole("radio", { name: "Nuevo tutor" }).click();
    await page.getByTestId("tutor-name").fill("Marta");
    await page.getByTestId("tutor-surname").fill("Soto");
    await page.getByTestId("tutor-phone").fill("+56 9 5550 0202");
    await page.getByTestId("tutor-city").fill("Santiago");

    await page.getByTestId("patient-submit").click();
    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByText("Protectora Sur")).toBeVisible();
    await expect(page.getByText("4 meses")).toBeVisible();
    await expect(page.getByText("Clínica Norte")).toBeVisible();
    await sinViolacionesAxe(page);
  });

  // FR-111/FR-112: pregunta cerrada y plan de la consulta, y su lectura.
  test("una pregunta cerrada se responde con A veces y el plan queda con el diagnóstico", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Luna E2E hoja etológica");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.goto(`/consultations/${consultationId}`);

      await page.getByRole("radio", { name: "Comportamiento cuando se queda solo" }).click();
      await page
        .getByRole("radio", { name: "¿Ladra, llora y/o aúlla cuando se queda solo?" })
        .click();
      await expect(page.getByTestId("anamnesis-text")).toHaveCount(0);
      await page.getByTestId("anamnesis-answer").getByRole("radio", { name: "A veces" }).click();
      await page.getByTestId("anamnesis-submit").click();
      await expect(page.getByTestId("anamnesis-entry").getByText("A veces")).toBeVisible();

      await page.getByTestId("plan-test-analisis-sangre").click();
      await page.getByTestId("plan-differential-1").fill("Fobia a ruidos");
      await page.getByTestId("plan-med-1-ingredient").fill("Fluoxetina");
      await page.getByTestId("plan-med-1-guideline").fill("1 mg/kg cada 24 h");
      await page.getByTestId("diagnosis-text").fill("Ansiedad por separación");
      await page.getByTestId("diagnosis-submit").click();

      const resumen = page.getByTestId("plan-summary");
      await expect(resumen).toContainText("Análisis de sangre");
      await expect(resumen).toContainText("Fobia a ruidos");
      await expect(resumen).toContainText("Fluoxetina — 1 mg/kg cada 24 h");
      await sinViolacionesAxe(page);
    } finally {
      await api.dispose();
    }
  });

  test("un principio activo sin pauta no se guarda y se explica", async ({ page }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Nube E2E plan incompleto");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.goto(`/consultations/${consultationId}`);
      await page.getByTestId("plan-med-1-ingredient").fill("Fluoxetina");
      await page.getByTestId("diagnosis-text").fill("Ansiedad");
      await page.getByTestId("diagnosis-submit").click();
      await expect(page.getByText("Completa el principio activo y su pauta")).toBeVisible();
      await expect(page.getByTestId("diagnosis-empty")).toBeVisible();
    } finally {
      await api.dispose();
    }
  });
});
