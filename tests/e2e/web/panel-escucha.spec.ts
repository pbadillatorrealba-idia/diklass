import type { Page } from "@playwright/test";
import { expect, SUPABASE_ANON_KEY, SUPABASE_URL, test } from "./fixtures";
import { abrirHilo } from "./panel";
import { prepararPaciente } from "./preparar-paciente";

// sistema-visual «Hilo de escucha», «La escucha no desplaza el formulario», «Escucha siempre visible»
// y «El borrador confirmado aterriza en su campo» (shell-asistente-tres-zonas, design.md D3/D4/D8/D9).
// Con el ASR simulado por defecto: con la app exportada en modo real corre modo-escucha-real.spec.ts.
test.describe("escucha en el panel de asistente (web)", () => {
  test.beforeEach(() => {
    test.skip(process.env.EXPO_PUBLIC_VOZ_MODO === "real", "App exportada con voz real.");
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  /** Caja de cada elemento con `testID` de la sección 1 «Anamnesis» (posición y tamaño). */
  const cajasDelFormulario = (page: Page) =>
    page.evaluate(() => {
      const seccion = document.querySelector('[data-testid="anamnesis-section"]');
      if (!seccion) throw new Error("Falta anamnesis-section");
      const cajas: Record<string, { x: number; y: number; width: number; height: number }> = {};
      const nodos = [seccion, ...seccion.querySelectorAll("[data-testid]")];
      for (const [indice, nodo] of nodos.entries()) {
        const { x, y, width, height } = nodo.getBoundingClientRect();
        cajas[`${indice}:${nodo.getAttribute("data-testid")}`] = { x, y, width, height };
      }
      return cajas;
    });

  for (const ancho of [1440, 1280]) {
    test(`a ${ancho} px la escucha no desplaza el formulario de la sección 1`, async ({ page }) => {
      const { api, patientId, crear } = await prepararPaciente(page, `Rucio`);
      try {
        const consultationId = await crear("consultation", { patientId, status: "open" });
        await page.setViewportSize({ width: ancho, height: 900 });
        await page.goto(`/consultations/${consultationId}`);
        await expect(page.getByTestId("anamnesis-section")).toBeVisible({ timeout: 15_000 });
        await page.waitForLoadState("networkidle");
        const antes = await cajasDelFormulario(page);
        expect(Object.keys(antes).length).toBeGreaterThan(3);

        // Activar la escucha y esperar tramos y borradores en el hilo.
        await abrirHilo(page, "escucha");
        await page.getByRole("button", { name: "Modo de escucha" }).click();
        await expect(page.getByTestId("draft-fact-card").first()).toBeVisible({ timeout: 15_000 });
        await expect(page.getByTestId("transcript-segment").first()).toBeVisible();
        expect(await cajasDelFormulario(page)).toEqual(antes);

        // En el cajón (1280 px), cerrarlo tampoco mueve nada.
        if (ancho < 1440) {
          await page.keyboard.press("Escape");
          await expect(page.getByTestId("assistant-drawer")).toHaveCount(0);
          expect(await cajasDelFormulario(page)).toEqual(antes);
        }
      } finally {
        await api.dispose();
      }
    });
  }

  test("confirmar un borrador lo lleva a su campo, visible, marcado «Nuevo» y anunciado", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Rucio");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.setViewportSize({ width: 1440, height: 800 });
      await page.goto(`/consultations/${consultationId}`);
      await expect(page.getByTestId("anamnesis-section")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("anamnesis-entry-new")).toHaveCount(0);

      await abrirHilo(page, "escucha");
      await page.getByRole("button", { name: "Modo de escucha" }).click();
      const borrador = page.getByTestId("draft-fact-card").first();
      await expect(borrador).toBeVisible({ timeout: 15_000 });
      const texto = (
        await borrador
          .getByRole("button", { name: /^Confirmar antecedente: / })
          .getAttribute("aria-label")
      )?.replace("Confirmar antecedente: ", "");

      // El formulario puede estar fuera de la vista: se baja para comprobar que luego se trae.
      await page.getByTestId("consultation-main").evaluate((nodo) => {
        nodo.ownerDocument.scrollingElement?.scrollTo(0, 0);
      });
      await borrador.getByTestId("draft-fact-confirm").click();

      const nueva = page.getByTestId("anamnesis-entry-new");
      await expect(nueva).toBeVisible({ timeout: 15_000 });
      await expect(nueva).toBeInViewport();
      const entrada = page.getByTestId("anamnesis-entry").filter({ has: nueva });
      await expect(entrada).toContainText(texto ?? "");
      // Código de procedencia «I» (Inferida) junto a «Nuevo».
      await expect(entrada.getByRole("img", { name: "Procedencia: Inferida" })).toBeVisible();
      await expect(page.getByTestId("consultation-status")).toHaveText(
        /Antecedente incorporado a la anamnesis/,
      );
      // Sin animación: ni el marcador ni su entrada animan nada.
      const animaciones = await entrada.evaluate(
        (nodo) => nodo.getAnimations({ subtree: true }).length,
      );
      expect(animaciones).toBe(0);

      // La marca dura hasta la siguiente acción del veterinario.
      await page.getByTestId("anamnesis-text").click();
      await page.keyboard.type("x");
      await expect(page.getByTestId("anamnesis-entry-new")).toHaveCount(0);
    } finally {
      await api.dispose();
    }
  });
});
