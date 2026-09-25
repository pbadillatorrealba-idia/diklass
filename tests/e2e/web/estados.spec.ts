import { ANA, expect, hasBackend, submitLogin, test } from "./fixtures";

// sistema-visual FR-085 · SC-056 · US14-AC5 (design.md D13): carga, error con reintento, vacío y
// contenido. La base local comparte una sola clínica sintética, así que «clínica sin fuentes» se
// reproduce respondiendo la lectura de la colección con una lista vacía.
test.describe("estados de datos", () => {
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");

  test.beforeEach(async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  });

  test("una clínica sin fuentes ve «Cargando…» y después el vacío con «Incorporar fuente clínica»", async ({
    page,
  }) => {
    let liberar: () => void = () => {};
    const respuestaRetenida = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    await page.route("**/rest/v1/knowledge_documents?*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await respuestaRetenida;
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });

    await page.goto("/knowledge/sources");
    await expect(page.getByTestId("fuentes-loading")).toHaveText("Cargando…");
    await expect(page.getByTestId("fuentes-loading")).toHaveAttribute("aria-busy", "true");
    // Nunca el vacío mientras la primera carga no termina.
    await expect(page.getByTestId("fuentes-empty")).toHaveCount(0);

    liberar();
    const vacio = page.getByTestId("fuentes-empty");
    await expect(vacio).toBeVisible();
    await expect(vacio).toContainText("Aún no hay fuentes clínicas");
    await expect(vacio.getByRole("link", { name: "Incorporar fuente clínica" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Incorporar fuente clínica" })).toHaveCount(1);
    await expect(page.getByTestId("fuentes-loading")).toHaveCount(0);
  });

  test("un error al cargar los pacientes ofrece «Reintentar», que vuelve a pedirlos", async ({
    page,
  }) => {
    let fallar = true;
    await page.route("**/rest/v1/clinical_records?*", async (route) => {
      const esLista = route.request().url().includes("record_type=eq.patient");
      if (fallar && esLista && route.request().method() === "GET") {
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "fallo sintético", code: "XX000" }),
        });
      }
      return route.continue();
    });

    await page.goto("/patients");
    const error = page.getByTestId("patients-error");
    await expect(error).toBeVisible({ timeout: 15_000 });
    await expect(error).toContainText("No pudimos cargar los pacientes");
    await expect(page.getByTestId("patient-item")).toHaveCount(0);

    fallar = false;
    await error.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByTestId("patient-item").first()).toBeVisible();
    await expect(page.getByTestId("patients-error")).toHaveCount(0);
  });

  // sistema-visual FR-087 · design.md D14: los datos clínicos y los errores se pueden copiar.
  test("el nombre de un paciente y un error se pueden seleccionar", async ({ page }) => {
    await page.goto("/patients");
    const nombre = page.getByTestId("patient-item").first().getByText(/.+/).first();
    await expect(nombre).toBeVisible({ timeout: 15_000 });
    const texto = (await nombre.textContent())?.trim() ?? "";
    await nombre.click({ clickCount: 3 });
    const seleccion = await page.evaluate(() => window.getSelection()?.toString().trim() ?? "");
    expect(texto.length).toBeGreaterThan(0);
    expect(seleccion).toBe(texto);
    expect(await nombre.evaluate((el) => getComputedStyle(el).userSelect)).toBe("text");

    await page.route("**/rest/v1/clinical_records?*", (route) =>
      route.request().url().includes("record_type=eq.patient")
        ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
        : route.continue(),
    );
    await page.reload();
    const mensaje = page
      .getByTestId("patients-error")
      .getByText("No pudimos cargar los pacientes.");
    await expect(mensaje).toBeVisible({ timeout: 15_000 });
    await mensaje.click({ clickCount: 3 });
    expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(
      "No pudimos cargar los pacientes.",
    );
    expect(await mensaje.evaluate((el) => getComputedStyle(el).userSelect)).toBe("text");
  });

  // Revisión de la PR #38 (FR-085): si falla la lectura de consultas, la cronología dependiente
  // quedaba en «Cargando…» para siempre en vez de ofrecer el error y «Reintentar».
  test("si fallan las consultas del seguimiento, la cronología muestra el error", async ({
    page,
  }) => {
    await page.goto("/follow-up");
    const abrir = page.getByTestId("follow-up-open").first();
    await expect(abrir).toBeVisible({ timeout: 15_000 });
    const href = await abrir.getAttribute("href");
    if (!href) throw new Error("sin enlace de seguimiento");
    await page.route("**/rest/v1/clinical_records?*", (route) =>
      route.request().url().includes("record_type=eq.consultation")
        ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
        : route.continue(),
    );
    await page.goto(href);
    const error = page.getByTestId("feedback-timeline-error");
    await expect(error).toBeVisible({ timeout: 15_000 });
    await expect(error.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await expect(page.getByTestId("feedback-timeline-loading")).toHaveCount(0);
  });
});
