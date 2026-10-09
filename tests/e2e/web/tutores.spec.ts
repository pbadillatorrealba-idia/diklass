import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { randomRut } from "../../support/rut";
import { ANA, expect, SUPABASE_ANON_KEY, SUPABASE_URL, submitLogin, test } from "./fixtures";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function sinViolacionesAxe(page: Page) {
  // `#error-toast` es el overlay de desarrollo de Expo (ver accessibility.spec.ts).
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_22_AA)
    .exclude("#error-toast")
    .analyze();
  expect(violations.map((violation) => violation.id)).toEqual([]);
}

test.describe("administración de tutores (administracion-tutores)", () => {
  test.beforeEach(() => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  // FR-119–FR-123: alta con validación, aviso de duplicado sin bloqueo, edición y búsqueda.
  test("alta, aviso de duplicado, edición y búsqueda por contacto", async ({ page }) => {
    const sufijo = Date.now().toString().slice(-8);
    const telefono = `+56 9 ${sufijo}`;
    const rut = randomRut();
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });

    // Sección propia en la barra lateral (enlace, no botón) y acceso también desde Pacientes.
    const lateral = page.getByTestId("nav-sidebar-tutors");
    await expect(lateral).toHaveAttribute("href", "/tutors");
    await page.goto("/patients");
    await expect(page.getByTestId("patients-tutors")).toHaveAttribute("href", "/tutors");
    await lateral.click();
    await expect(page.getByTestId("tutors-screen")).toBeVisible({ timeout: 15_000 });
    await sinViolacionesAxe(page);

    await page.getByTestId("tutors-register").click();
    await expect(page).toHaveURL(/\/tutors\/new$/);

    // FR-121: un RUT con dígito verificador erróneo se señala junto al campo.
    await page.getByTestId("tutor-name").fill(`Tutora E2E ${sufijo}`);
    await page.getByTestId("tutor-rut").fill("12345678-4");
    await page.getByTestId("tutor-phone").fill(telefono);
    await page.getByTestId("tutor-submit").click();
    await expect(page.getByText("Registra un RUT válido")).toBeVisible();
    await expect(page).toHaveURL(/\/tutors\/new$/);

    // Con el RUT bien escrito pero sin contacto, no se crea nada.
    await page.getByTestId("tutor-rut").fill(rut);
    await page.getByTestId("tutor-phone").fill("");
    await page.getByTestId("tutor-submit").click();
    await expect(page.getByText("Registra al menos un medio de contacto")).toBeVisible();
    await expect(page).toHaveURL(/\/tutors\/new$/);
    await sinViolacionesAxe(page);

    await page.getByTestId("tutor-phone").fill(telefono);
    await page.getByTestId("tutor-submit").click();
    await expect(page).toHaveURL(/\/tutors\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: `Tutora E2E ${sufijo}` })).toBeVisible();

    // El RUT es único por clínica: repetirlo bloquea y nombra al tutor existente.
    await page.goto("/tutors/new");
    await page.getByTestId("tutor-name").fill(`Homónimo E2E ${sufijo}`);
    await page.getByTestId("tutor-rut").fill(rut);
    await page.getByTestId("tutor-phone").fill("+56 9 0000 0000");
    await page.getByTestId("tutor-submit").click();
    await expect(page.getByText(`Ya hay un tutor con este RUT: Tutora E2E ${sufijo}`)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/tutors\/new$/);

    // FR-122: mismo teléfono, otra persona. Avisa, no bloquea.
    await page.goto("/tutors/new");
    await page.getByTestId("tutor-name").fill(`Familiar E2E ${sufijo}`);
    await page.getByTestId("tutor-rut").fill(randomRut());
    await page.getByTestId("tutor-phone").fill(telefono);
    await page.getByTestId("tutor-submit").click();
    await expect(page.getByTestId("tutor-duplicate")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("tutor-duplicate-link")).toContainText(`Tutora E2E ${sufijo}`);
    await expect(page).toHaveURL(/\/tutors\/new$/);
    await sinViolacionesAxe(page);
    await page.getByTestId("tutor-submit").click();
    await expect(page).toHaveURL(/\/tutors\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // FR-123: edición del contacto en la ficha. Cambiar el RUT al de otro tutor se señala junto al campo.
    const nuevoTelefono = `+56 9 ${sufijo.split("").reverse().join("")}`;
    await page.getByTestId("tutor-edit").click();
    await page.getByTestId("tutor-card").getByTestId("tutor-rut").fill(rut);
    await page.getByTestId("tutor-edit-save").click();
    await expect(page.getByText(`Ya hay un tutor con este RUT: Tutora E2E ${sufijo}`)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("tutor-card").getByTestId("tutor-rut").fill(randomRut());
    // La pila deja montada la pantalla de alta: se acota a la card de la ficha.
    await page.getByTestId("tutor-card").getByTestId("tutor-phone").fill(nuevoTelefono);
    await page.getByTestId("tutor-edit-save").click();
    await expect(page.getByTestId("tutor-status")).toContainText("Tutor actualizado");
    await expect(page.getByTestId("tutor-card").getByText(nuevoTelefono)).toBeVisible();

    // FR-120: búsqueda por contacto y estado en la URL.
    await page.goto("/tutors");
    await page.getByLabel("Filtrar por RUT, teléfono o correo").fill(telefono);
    await expect(page).toHaveURL(/contact=/);
    await expect(page.getByTestId("tutor-item")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByTestId("tutor-item")).toContainText(`Tutora E2E ${sufijo}`);
    await expect(page.getByTestId("tutor-open")).toHaveAttribute("href", /^\/tutors\//);
  });
});
