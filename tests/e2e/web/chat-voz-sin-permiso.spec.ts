import { ANA, expect, hasBackend, submitLogin, test } from "./fixtures";
import { consentimientoDeVoz } from "./panel";

// asistente-conversacional «Grabar, revisar y enviar audio»: sin permiso de micrófono (FR-054). Archivo
// aparte: aquí no hay micrófono falso ni aceptación automática, así que Chromium rechaza `getUserMedia`.
test.use({ permissions: [] });

test.describe("mensajes de voz sin permiso de micrófono", () => {
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");

  test("sin acceso al micrófono lo dice y ofrece escribir (FR-054)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    await consentimientoDeVoz(page, true);
    await page.reload();
    const panel = page.getByTestId("assistant-panel");
    await panel.getByTestId("voice-record").click();
    await expect(panel.getByTestId("voice-notice")).toContainText("micrófono", { timeout: 10_000 });
    await expect(panel.getByTestId("voice-notice")).toContainText("escribir");
    // Escribir sigue disponible.
    await expect(panel.getByTestId("composer-input")).toBeEditable();
  });
});
