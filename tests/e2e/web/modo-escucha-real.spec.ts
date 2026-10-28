import type { Page } from "@playwright/test";
import { expect, SUPABASE_ANON_KEY, SUPABASE_URL, test } from "./fixtures";
import { abrirHilo } from "./panel";
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

/** Intercepta `transcribe-audio` (sin OpenAI) y cuenta las ventanas que llegan a transcribirse. */
async function interceptarTranscripcion(page: Page) {
  const transcripciones = { count: 0 };
  await page.route("**/functions/v1/transcribe-audio", async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    transcripciones.count += 1;
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
  return transcripciones;
}

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
    const { api, patientId, crear } = await prepararPaciente(page, "Rucio");
    const transcripciones = await interceptarTranscripcion(page);

    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.goto(`/consultations/${consultationId}`);
      // El control de escucha vive en el hilo «Escucha» del panel de asistente.
      await abrirHilo(page, "escucha");
      await expect(page.getByTestId("recording-notice")).toHaveCount(0);

      await page.getByRole("button", { name: "Modo de escucha" }).click();
      // D5: el aviso de grabación y conservación aparece mientras se captura.
      await expect(page.getByTestId("recording-notice")).toContainText(
        "Se está grabando y conservando el audio",
      );
      await expect(page.getByTestId("draft-fact-card").first()).toBeVisible({ timeout: 20_000 });
      expect(transcripciones.count).toBeGreaterThan(0);

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
    const { api, patientId, crear } = await prepararPaciente(page, "Cholito");
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.goto(`/consultations/${consultationId}`);
      await abrirHilo(page, "escucha");
      await page.getByRole("button", { name: "Modo de escucha" }).click();
      await expect(page.getByTestId("listen-status-indicator")).toContainText(
        "Captura no disponible",
      );
      await expect(page.getByTestId("recording-notice")).toHaveCount(0);
    } finally {
      await api.dispose();
    }
  });
  // sistema-visual «Escucha siempre visible» (D8): con el panel colapsado el riel muestra la
  // captura y deja detenerla; colapsar no la detiene.
  test("con el panel colapsado el riel muestra estado, tiempo, aviso y Detener, y la captura sigue", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Rucio");
    const transcripciones = await interceptarTranscripcion(page);
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/consultations/${consultationId}`);
      await abrirHilo(page, "escucha");
      await page.getByRole("button", { name: "Modo de escucha" }).click();
      await expect(page.getByTestId("recording-notice")).toBeVisible();

      // Colapsar el panel: el hilo desaparece pero la captura sigue y el riel la muestra.
      await page.getByTestId("assistant-toggle").click();
      const riel = page.getByTestId("assistant-rail");
      await expect(riel).toBeVisible();
      await expect(page.getByTestId("recording-notice")).toHaveCount(0);
      const estado = riel.getByTestId("listen-status-rail");
      await expect(estado).toContainText("Grabando");
      await expect(estado.getByRole("status")).toHaveAccessibleName("Grabando y conservando audio");
      await expect(riel.getByTestId("listen-elapsed-rail")).toHaveText(/^\d{2}:\d{2}$/);
      // Cabe en el riel de 56 px: nada del estado sobresale de él.
      const cajaRiel = await riel.boundingBox();
      for (const id of ["listen-status-rail", "listen-stop-rail", "listen-elapsed-rail"]) {
        const caja = await riel.getByTestId(id).boundingBox();
        expect(caja?.x).toBeGreaterThanOrEqual((cajaRiel?.x ?? 0) - 1);
        expect((caja?.x ?? 0) + (caja?.width ?? 0)).toBeLessThanOrEqual(
          (cajaRiel?.x ?? 0) + (cajaRiel?.width ?? 0) + 1,
        );
      }

      // La captura sigue con el panel colapsado: llegan más ventanas a transcribirse.
      const antes = transcripciones.count;
      await expect.poll(() => transcripciones.count, { timeout: 15_000 }).toBeGreaterThan(antes);

      // «Detener» desde el riel termina la captura.
      await riel.getByRole("button", { name: "Detener el modo de escucha clínica" }).click();
      await expect(riel.getByTestId("listen-stop-rail")).toHaveCount(0);
      await page.getByTestId("assistant-toggle").click();
      await expect(page.getByTestId("listen-status-indicator")).toHaveText(/Escucha detenida/);
    } finally {
      await api.dispose();
    }
  });
  // sistema-visual «Dock de asistente en compacto» y «Hoja del asistente en compacto» (D7): a
  // 375 px la cinta muestra la captura siempre; cerrar la hoja no la detiene.
  test("a 375 px la cinta sigue visible al desplazar y escribir, y cerrar la hoja no detiene la captura", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Rucio");
    const transcripciones = await interceptarTranscripcion(page);
    try {
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.setViewportSize({ width: 375, height: 700 });
      await page.goto(`/consultations/${consultationId}`);
      await expect(page.getByTestId("anamnesis-section")).toBeVisible({ timeout: 15_000 });

      // Se activa la escucha desde la hoja y se cierra con Escape: la captura sigue.
      const abrir = page.getByTestId("panel-dock-open");
      await abrir.click();
      const hoja = page.getByTestId("panel-sheet");
      await hoja.getByTestId("assistant-thread-escucha").click();
      await hoja.getByRole("button", { name: "Modo de escucha" }).click();
      await expect(hoja.getByTestId("recording-notice")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("panel-sheet")).toHaveCount(0);
      await expect(abrir).toBeFocused();

      // La cinta muestra estado, aviso de grabación, tiempo y Detener, con la hoja cerrada.
      const cinta = page.getByTestId("panel-dock");
      const estado = cinta.getByTestId("listen-status-dock");
      await expect(estado).toContainText("Grabando y conservando audio");
      await expect(cinta.getByTestId("listen-elapsed-dock")).toHaveText(/^\d{2}:\d{2}$/);
      const detener = cinta.getByRole("button", { name: "Detener el modo de escucha clínica" });
      await expect(detener).toBeVisible();
      const caja = await detener.boundingBox();
      expect(caja?.height).toBeGreaterThanOrEqual(44);
      expect(caja?.width).toBeGreaterThanOrEqual(44);

      // Al desplazar el formulario y al escribir en un campo, la cinta no se va ni la tapa nada.
      await page.getByTestId("anamnesis-text").scrollIntoViewIfNeeded();
      await page.getByTestId("anamnesis-text").click();
      await page.keyboard.type("Vocaliza cuando se queda sola");
      await expect(cinta).toBeInViewport();
      await expect(estado).toBeInViewport();
      await expect(detener).toBeInViewport();

      // La captura siguió con la hoja cerrada: llegan más ventanas a transcribirse.
      const antes = transcripciones.count;
      await expect.poll(() => transcripciones.count, { timeout: 15_000 }).toBeGreaterThan(antes);

      // «Detener» desde la cinta termina la captura.
      await detener.click();
      await expect(cinta.getByTestId("listen-status-dock")).toHaveCount(0);
    } finally {
      await api.dispose();
    }
  });
});
