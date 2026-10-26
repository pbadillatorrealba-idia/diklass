import { expect, SUPABASE_ANON_KEY, SUPABASE_URL, test } from "./fixtures";
import { prepararPaciente } from "./preparar-paciente";

/**
 * Modo de escucha con el micrófono real del navegador (cambio implementar-asr-real-captura-voz ·
 * D2 · D4 · D5). La app se exporta con `EXPO_PUBLIC_VOZ_MODO=real` y ventanas cortas:
 *
 *   E2E_CLEAR_CACHE=1 EXPO_PUBLIC_VOZ_MODO=real EXPO_PUBLIC_VOZ_VENTANA_MS=2000 bunx playwright test \
 *     modo-escucha-real.spec.ts --project=chromium --workers=1
 *
 * Chromium aporta un micrófono falso (--use-fake-device-for-media-stream), así que la captura y la
 * subida del audio a Storage son reales; solo la función `transcribe-audio` se intercepta, para no
 * depender de OpenAI (esa ruta se prueba aparte en tests/integration/voz/asr-openai.test.ts).
 */
const MODO_REAL = process.env.EXPO_PUBLIC_VOZ_MODO === "real";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};

test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.describe("modo de escucha con micrófono real (web)", () => {
  test.beforeEach(({ browserName }) => {
    test.skip(!MODO_REAL, "Requiere exportar la app con EXPO_PUBLIC_VOZ_MODO=real.");
    test.skip(browserName !== "chromium", "El micrófono falso es de Chromium.");
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  test("graba, avisa, transcribe, conserva el audio y deja borradores", async ({ page }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Rocky E2E micrófono");
    let transcripciones = 0;
    await page.route("**/functions/v1/transcribe-audio", async (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers: CORS });
      }
      transcripciones += 1;
      return route.fulfill({
        status: 200,
        headers: CORS,
        contentType: "application/json",
        body: JSON.stringify({
          text: "Le dimos fluoxetina durante un mes, pero no hubo mejoría",
          quality: "ok",
          requestId: "e2e",
        }),
      });
    });

    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.goto(`/consultations/${consultationId}`);
      await expect(page.getByTestId("recording-notice")).toHaveCount(0);

      await page.getByRole("button", { name: "Modo de escucha" }).click();
      // D5: el aviso de grabación y conservación aparece mientras se captura.
      await expect(page.getByTestId("recording-notice")).toContainText(
        "Se está grabando y conservando el audio",
      );
      await expect(page.getByTestId("draft-fact-card").first()).toBeVisible({ timeout: 20_000 });
      expect(transcripciones).toBeGreaterThan(0);

      await page.getByRole("button", { name: "Detener el modo de escucha clínica" }).click();
      await expect(page.getByTestId("listen-status-indicator")).toHaveText(/Escucha detenida/);
      await expect(page.getByTestId("recording-notice")).toHaveCount(0);

      // D4: el tramo guarda la ruta de su audio y el audio existe en Storage.
      const sesion = await api.get(
        `/rest/v1/listening_sessions?select=id&consultation_id=eq.${consultationId}`,
      );
      const [primeraSesion] = (await sesion.json()) as Array<{ id: string }>;
      const sessionId = primeraSesion?.id;
      expect(sessionId).toBeTruthy();
      const tramos = await api.get(
        `/rest/v1/transcript_segments?select=audio_path&listening_session_id=eq.${sessionId}&order=seq`,
      );
      const rutas = ((await tramos.json()) as Array<{ audio_path: string | null }>).map(
        (tramo) => tramo.audio_path,
      );
      expect(rutas.length).toBeGreaterThan(0);
      const [primera] = rutas;
      expect(primera).toMatch(/^[\w-]+\/[\w-]+\/0\.webm$/);
      const audio = await api.get(`/storage/v1/object/authenticated/consultation-audio/${primera}`);
      expect(audio.status()).toBe(200);
      expect((await audio.body()).byteLength).toBeGreaterThan(0);
    } finally {
      await api.dispose();
    }
  });

  test("FR-054: sin permiso de micrófono la escucha queda no disponible y la anamnesis manual sigue", async ({
    page,
    context,
  }) => {
    await context.clearPermissions();
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("denegado", "NotAllowedError"));
    });
    const { api, patientId, crear } = await prepararPaciente(page, "Luna E2E sin micrófono");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.goto(`/consultations/${consultationId}`);
      await page.getByRole("button", { name: "Modo de escucha" }).click();
      await expect(page.getByTestId("listen-status-indicator")).toContainText(
        "Captura no disponible",
      );
      await expect(page.getByTestId("recording-notice")).toHaveCount(0);
    } finally {
      await api.dispose();
    }
  });
});
