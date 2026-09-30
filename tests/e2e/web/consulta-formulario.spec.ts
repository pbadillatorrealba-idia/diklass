import { ANA, expect, SUPABASE_ANON_KEY, SUPABASE_URL, test } from "./fixtures";
import { type Crear, prepararPaciente } from "./preparar-paciente";

/**
 * La consulta como formulario en copias (sistema-visual US18 · FR-097 · FR-099 · design.md D20):
 * encabezado con la clave de procedencia, secciones numeradas, códigos al margen y la firma.
 */

const PROCEDENCIAS = [
  ["reportada", "Reportada", "Vocaliza de noche desde hace una semana"],
  ["inferida", "Inferida", "Posible ansiedad por separación"],
  ["recuperada", "Recuperada", "Vacunas al día según la ficha anterior"],
  ["desconocida", "Desconocida", "Dieta sin precisar"],
] as const;

/** Consulta abierta con una entrada de anamnesis por procedencia. */
async function consultaConAnamnesis(crear: Crear, patientId: string): Promise<string> {
  const consultationId = await crear("consultation", { patientId, status: "open" });
  for (const [provenance, , text] of PROCEDENCIAS) {
    await crear("anamnesis", { consultationId, field: "motivo_consulta", text, provenance });
  }
  return consultationId;
}

test.describe("consulta como formulario", () => {
  test.beforeEach(() => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  // US18-AC1 · SC-061: cada dato con procedencia lleva su código al margen, con nombre.
  test("cada entrada de anamnesis muestra su código de procedencia con nombre", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Kira E2E formulario");
    try {
      const consultationId = await consultaConAnamnesis(crear, patientId);
      await page.goto(`/consultations/${consultationId}`);

      const entradas = page.getByTestId("anamnesis-entry").filter({ visible: true });
      await expect(entradas).toHaveCount(PROCEDENCIAS.length);
      for (const [, label, text] of PROCEDENCIAS) {
        const entrada = entradas.filter({ hasText: text });
        await expect(entrada.getByRole("img", { name: `Procedencia: ${label}` })).toBeVisible();
      }
      await expect(
        entradas.filter({ hasText: "Posible ansiedad" }).getByRole("img", {
          name: "Procedencia: Inferida",
        }),
      ).toHaveText("I");

      // Secciones numeradas en el orden del flujo clínico (D20).
      const secciones = page.getByRole("heading", { level: 2 }).filter({ visible: true });
      await expect(secciones).toHaveText(["1 Anamnesis", "2 Diagnóstico", "3 Epicrisis y firma"]);
    } finally {
      await api.dispose();
    }
  });

  // US18-AC2: el encabezado del formulario y la clave caben en la primera vista.
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 375, height: 667 },
  ]) {
    test(`a ${viewport.width}×${viewport.height} el encabezado muestra la clave sin desplazarse`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      const nombre = `Olivia E2E clave ${viewport.width}`;
      const { api, patientId, crear } = await prepararPaciente(page, nombre);
      try {
        const consultationId = await consultaConAnamnesis(crear, patientId);
        await page.goto(`/consultations/${consultationId}`);

        const encabezado = page.getByTestId("consultation-header").filter({ visible: true });
        await expect(encabezado).toContainText(nombre);
        await expect(encabezado).toContainText(`Tutor de ${nombre}`);
        await expect(encabezado).toContainText("Consulta n.º 1");

        const clave = page.getByRole("list", { name: "Clave de procedencia" });
        await expect(clave).toBeInViewport({ ratio: 1 });
        for (const code of ["R", "I", "F", "?"]) {
          await expect(clave.getByText(code, { exact: true })).toBeVisible();
        }
        for (const [, label] of PROCEDENCIAS) {
          await expect(clave.getByText(label, { exact: true })).toBeVisible();
        }
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
      } finally {
        await api.dispose();
      }
    });
  }

  // Revisión de la PR #41: la corrección de procedencia se elige y se confirma aparte; se cancela
  // sin registrar nada y el foco nunca cae al documento (WCAG 2.4.3).
  test("corregir procedencia se confirma aparte, se cancela sin registrar y conserva el foco", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Lluvia E2E procedencia");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await crear("anamnesis", {
        consultationId,
        field: "motivo_consulta",
        text: "Come poco desde el lunes",
        provenance: "reportada",
      });
      await page.goto(`/consultations/${consultationId}`);

      const entrada = page
        .getByTestId("anamnesis-entry")
        .filter({ visible: true })
        .filter({ hasText: "Come poco desde el lunes" });
      const abrir = entrada.getByRole("button", {
        name: "Corregir procedencia de Motivo de consulta",
      });
      const grupo = entrada.getByRole("radiogroup", { name: "Corregir procedencia" });
      const guardar = entrada.getByRole("button", { name: "Guardar corrección de procedencia" });
      const reemplazos = entrada.getByTestId("anamnesis-provenance-history");

      // Al desplegar, el foco va a la opción vigente y guardarla no es una corrección.
      await abrir.click();
      await expect(abrir).toHaveAttribute("aria-expanded", "true");
      await expect(grupo.getByRole("radio", { name: "Reportada" })).toBeFocused();
      await expect(guardar).toBeDisabled();

      // Las flechas solo mueven la selección: nada queda registrado.
      await page.keyboard.press("ArrowRight");
      await expect(grupo.getByRole("radio", { name: "Inferida" })).toBeChecked();
      await expect(guardar).toBeEnabled();
      await expect(entrada.getByRole("img", { name: "Procedencia: Reportada" })).toBeVisible();

      // Cancelar pliega sin escribir y devuelve el foco al botón.
      await entrada.getByRole("button", { name: "Cancelar la corrección de procedencia" }).click();
      await expect(grupo).toHaveCount(0);
      await expect(abrir).toBeFocused();
      await expect(reemplazos).toHaveCount(0);

      // Confirmar registra la corrección y devuelve el foco al botón.
      await abrir.click();
      await page.keyboard.press("ArrowRight");
      await guardar.click();
      await expect(entrada.getByRole("img", { name: "Procedencia: Inferida" })).toBeVisible();
      await expect(reemplazos).toContainText("R · Reportada");
      await expect(grupo).toHaveCount(0);
      await expect(abrir).toBeFocused();
    } finally {
      await api.dispose();
    }
  });

  // Revisión final de D20: el borrador se lee entero antes de firmarlo.
  test("un campo largo del borrador crece y no esconde texto", async ({ page }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Nieve E2E campo largo");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.goto(`/consultations/${consultationId}`);
      await page.getByRole("button", { name: "Generar borrador de epicrisis" }).click();
      const campo = page.getByLabel("Observaciones", { exact: true });
      await campo.fill(
        Array.from({ length: 12 }, (_, i) => `Línea ${i + 1} de observación`).join("\n"),
      );
      await expect
        .poll(() => campo.evaluate((el) => el.scrollHeight - el.clientHeight))
        .toBeLessThanOrEqual(1);
    } finally {
      await api.dispose();
    }
  });

  // US18-AC4 · FR-099: con Reduce Motion, el timbre aparece sin animación y el pliego se va.
  test("al firmar con movimiento reducido, el timbre aparece de inmediato y el pliego desaparece", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { api, patientId, crear } = await prepararPaciente(page, "Bruma E2E firma");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.goto(`/consultations/${consultationId}`);
      await page.getByRole("button", { name: "Generar borrador de epicrisis" }).click();
      await expect(
        page.getByRole("group", { name: "Sugerencia del sistema · copia sin firmar" }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Firmar y cerrar consulta" }).click();

      const timbre = page.getByRole("group", {
        name: new RegExp(`^Firmado por ${ANA.displayName} el `),
      });
      await expect(timbre).toBeVisible();
      await expect(timbre).toContainText(ANA.displayName);
      await expect(timbre).toContainText(/\d{1,2}:\d{2}/);
      // Sin animación: lo primero que se pinta ya es el estado final (una sola lectura, sin
      // reintentos, justo al aparecer).
      const movimiento = page.getByTestId("signature-motion");
      expect(await movimiento.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
      expect(
        await page.getByTestId("epicrisis-paper").evaluate((el) => getComputedStyle(el).opacity),
      ).toBe("0");
      await expect(
        page.getByRole("group", { name: "Sugerencia del sistema · copia sin firmar" }),
      ).toHaveCount(0);
    } finally {
      await api.dispose();
    }
  });
});
