import { expect, SUPABASE_ANON_KEY, SUPABASE_URL, test } from "./fixtures";
import { abrirHilo } from "./panel";
import { prepararPaciente } from "./preparar-paciente";

test.describe("modo de escucha web (captura de voz hacia anamnesis)", () => {
  test.beforeEach(() => {
    // Con la app exportada en modo real corre modo-escucha-real.spec.ts (otro micrófono, otro guion).
    test.skip(process.env.EXPO_PUBLIC_VOZ_MODO === "real", "App exportada con voz real.");
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  // R2 · FR-014 · FR-016 · FR-017 · US6-AC1 · US6-AC5 · US6-AC6: con el ASR simulado por defecto,
  // activar la escucha deja tramos y borradores; confirmar uno lo aterriza en la anamnesis
  // y detener funciona en cualquier momento.
  test("activar la escucha deja borradores, confirmar uno lo lleva a la anamnesis y detener cierra la captura", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Rucio");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.goto(`/consultations/${consultationId}`);
      // El control de escucha vive en el hilo «Escucha» del panel de asistente.
      await abrirHilo(page, "escucha");

      await expect(page.getByTestId("listen-status-indicator")).toHaveText(/Escucha inactiva/);
      await page.getByRole("button", { name: "Modo de escucha" }).click();

      const borradores = page.getByTestId("draft-fact-card");
      await expect(borradores.first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("transcript-segment").first()).toBeVisible();

      const antecedente = borradores.first();
      const texto = (
        await antecedente
          .getByRole("button", { name: /^Confirmar antecedente: / })
          .getAttribute("aria-label")
      )?.replace("Confirmar antecedente: ", "");
      await antecedente.getByTestId("draft-fact-confirm").click();
      await expect(
        page
          .getByTestId("consultation-main")
          .getByText(texto ?? "", { exact: false })
          .first(),
      ).toBeVisible();

      // Detener funciona en cualquier momento (US6-AC5), incluso con la captura ya agotada.
      const detener = page.getByRole("button", { name: "Detener el modo de escucha clínica" });
      if (await detener.isVisible()) {
        await detener.click();
      }
      await expect(page.getByTestId("listen-status-indicator")).toHaveText(/Escucha detenida/);
    } finally {
      await api.dispose();
    }
  });
});
