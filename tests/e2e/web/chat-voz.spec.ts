import AxeBuilder from "@axe-core/playwright";
import {
  type APIRequestContext,
  request as apiRequest,
  type Page,
  type Route,
} from "@playwright/test";
import {
  ANA,
  expect,
  hasBackend,
  readSupabaseSession,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  submitLogin,
  test,
} from "./fixtures";
import { abrirHilo, consentimientoDeVoz, limpiarConversacion } from "./panel";
import { prepararPaciente } from "./preparar-paciente";

// asistente-conversacional «Grabar, revisar y enviar audio», «Transcripción del audio del chat» y
// «Conservación del audio por 90 días» (chat-del-asistente, tareas 7.3 a 7.5). Micrófono falso de
// Chromium; el ASR y Storage se interceptan (el ASR real cuesta y Storage local puede no estar sano):
// lo que se prueba es la interfaz, la máquina de estados y la persistencia del mensaje.
const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
async function sinViolaciones(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  const propias = violations
    .map(({ id, help, nodes }) => ({
      id,
      help,
      nodes: nodes
        .filter((node) => !node.target.some((parte) => String(parte).includes("#error-toast")))
        .map((node) => ({ target: node.target, why: node.failureSummary })),
    }))
    .filter((violacion) => violacion.nodes.length > 0);
  expect(propias).toEqual([]);
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "*",
};
const responder = (route: Route, status: number, body: unknown) =>
  route.request().method() === "OPTIONS"
    ? route.fulfill({ status: 200, headers: CORS })
    : route.fulfill({
        status,
        headers: { ...CORS, "content-type": "application/json" },
        body: JSON.stringify(body),
      });

async function simular(
  page: Page,
  transcripcion: { text: string; quality: "ok" | "insufficient" },
) {
  const contadores = { subidas: 0, borrados: 0, firmas: 0, transcripciones: 0 };
  await page.route("**/functions/v1/transcribe-chat-audio", (route) => {
    if (route.request().method() !== "OPTIONS") contadores.transcripciones++;
    return responder(route, 200, { ...transcripcion, requestId: "e2e" });
  });
  await page.route("**/storage/v1/object/assistant-audio/**", (route) => {
    if (route.request().method() === "POST") contadores.subidas++;
    return responder(route, 200, { Key: "assistant-audio/x", Id: "x" });
  });
  await page.route("**/storage/v1/object/assistant-audio", (route) => {
    if (route.request().method() === "DELETE") contadores.borrados++;
    return responder(route, 200, []);
  });
  await page.route("**/storage/v1/object/sign/assistant-audio/**", (route) => {
    if (route.request().method() === "POST") contadores.firmas++;
    return responder(route, 200, { signedURL: "/object/sign/assistant-audio/x?token=t" });
  });
  return contadores;
}

// Nivel de archivo: `launchOptions` fuerza un worker nuevo y no se admite dentro de un describe.
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test.describe("mensajes de voz del chat (micrófono falso)", () => {
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");

  let api: APIRequestContext;

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    await limpiarConversacion(page);
    // El aviso de primer uso ya está aceptado (se prueba aparte).
    await consentimientoDeVoz(page, true);
    await page.reload();
    const { accessToken } = await readSupabaseSession(page);
    api = await apiRequest.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
  });

  test.afterEach(async () => {
    await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
    await api.dispose();
  });

  const panel = (page: Page) => page.getByTestId("assistant-panel");
  const grabar = async (page: Page, ms: number) => {
    await panel(page).getByTestId("voice-record").click();
    await expect(panel(page).getByTestId("voice-panel")).toBeVisible();
    await page.waitForTimeout(ms);
    await panel(page).getByTestId("voice-stop").click();
  };

  test("grabar, revisar y enviar: aparece el mensaje con su transcripción y el asistente responde", async ({
    page,
  }) => {
    const c = await simular(page, { text: "¿Qué día es hoy?", quality: "ok" });
    await panel(page).getByTestId("voice-record").click();
    const grabando = panel(page).getByTestId("voice-panel");
    await expect(grabando).toContainText("Grabando y conservando audio");
    await expect(grabando).toContainText("90 días");
    await expect(panel(page).getByTestId("voice-elapsed")).toBeVisible();
    await page.waitForTimeout(1500);
    await panel(page).getByTestId("voice-stop").click();

    // Revisión: reproducir, descartar y enviar.
    const revision = panel(page).getByTestId("voice-panel");
    await expect(revision).toContainText("Revisa tu mensaje de voz");
    await expect(panel(page).getByTestId("voice-play")).toBeVisible();
    await expect(panel(page).getByTestId("voice-discard")).toBeVisible();
    await panel(page).getByTestId("voice-send").click();

    await expect(panel(page).getByTestId("message-user")).toContainText("¿Qué día es hoy?", {
      timeout: 15_000,
    });
    await expect(panel(page).getByTestId("message-user")).toContainText("Audio ·");
    await expect(panel(page).getByTestId("message-assistant").last()).toContainText(/Hoy es/, {
      timeout: 15_000,
    });
    expect(c.subidas).toBe(1);
    expect(c.transcripciones).toBe(1);

    // Quedó persistido con la ruta canónica y el vencimiento a 90 días fijado por el servidor.
    const filas = await api.get(
      "/rest/v1/assistant_messages?select=audio_path,audio_expires_at,created_at&audio_path=not.is.null",
    );
    const [fila] = (await filas.json()) as Array<{
      audio_path: string;
      audio_expires_at: string;
      created_at: string;
    }>;
    expect(fila?.audio_path).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webm|m4a)$/);
    const dias =
      (new Date(fila?.audio_expires_at ?? 0).getTime() -
        new Date(fila?.created_at ?? 0).getTime()) /
      86_400_000;
    expect(Math.round(dias)).toBe(90);
  });

  // Aviso de primer uso con aceptación: el audio y su transcripción van a un proveedor externo.
  test("la primera vez pide aceptar el aviso del proveedor externo antes de grabar", async ({
    page,
  }) => {
    await consentimientoDeVoz(page, false);
    await page.reload();
    await simular(page, { text: "¿Qué día es hoy?", quality: "ok" });

    await panel(page).getByTestId("voice-record").click();
    const aviso = panel(page).getByRole("alertdialog", { name: "Aviso antes de grabar" });
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText("proveedor externo");
    await expect(aviso).toContainText("OpenAI");
    await expect(aviso).toContainText("90 días");
    // No empezó a grabar y el foco entra en «Cancelar».
    await expect(panel(page).getByTestId("voice-panel")).toHaveCount(0);
    await expect(panel(page).getByTestId("voice-consent-cancel")).toBeFocused();

    await panel(page).getByTestId("voice-consent-cancel").click();
    await expect(panel(page).getByTestId("voice-consent")).toHaveCount(0);
    await expect(panel(page).getByTestId("voice-panel")).toHaveCount(0);
    // «Rechazar el aviso»: el foco vuelve al botón de grabar.
    await expect(panel(page).getByTestId("voice-record")).toBeFocused();

    // Aceptar guarda el consentimiento (autor y momento los fija el servidor) y empieza a grabar.
    await panel(page).getByTestId("voice-record").click();
    await panel(page).getByTestId("voice-consent-accept").click();
    await expect(panel(page).getByTestId("voice-panel")).toContainText(
      "Grabando y conservando audio",
    );
    const filas = await api.get("/rest/v1/assistant_voice_consent?select=version");
    expect(await filas.json()).toEqual([{ version: "v1" }]);
    await panel(page).getByTestId("voice-cancel").click();

    // La segunda vez ya no pregunta.
    await panel(page).getByTestId("voice-record").click();
    await expect(panel(page).getByTestId("voice-consent")).toHaveCount(0);
    await expect(panel(page).getByTestId("voice-panel")).toBeVisible();
    await panel(page).getByTestId("voice-cancel").click();
  });

  // Un error al cargar el consentimiento no deja un bucle de aviso: se dice y se reintenta.
  test("si falla la comprobación del aviso, lo dice y reintenta en lugar de repetir el diálogo", async ({
    page,
  }) => {
    let fallar = true;
    await page.route("**/rest/v1/assistant_voice_consent*", (route) =>
      fallar && route.request().method() === "GET"
        ? route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
        : route.continue(),
    );
    await page.reload();
    await expect(panel(page).getByTestId("voice-record")).toBeEnabled({ timeout: 15_000 });
    await page.waitForTimeout(1000); // la comprobación falla y pasa a «error»
    await panel(page).getByTestId("voice-record").click();
    await expect(panel(page)).toContainText("No se pudo comprobar tu aceptación");
    await expect(panel(page).getByTestId("voice-consent")).toHaveCount(0);

    // Pulsar de nuevo reintenta la comprobación; con el servidor sano, el siguiente toque ya graba.
    fallar = false;
    await panel(page).getByTestId("voice-record").click();
    await page.waitForTimeout(1000);
    await panel(page).getByTestId("voice-record").click();
    await expect(panel(page).getByTestId("voice-panel")).toBeVisible({ timeout: 15_000 });
    await panel(page).getByTestId("voice-cancel").click();
  });

  // WCAG 2.4.3: el panel se desmonta con cada acción y el foco no debe perderse.
  test("el foco va a «Reproducir» al revisar (no a «Enviar») y vuelve al botón de grabar al terminar", async ({
    page,
  }) => {
    await simular(page, { text: "¿Qué día es hoy?", quality: "ok" });
    await grabar(page, 1500);
    await expect(panel(page).getByTestId("voice-play")).toBeFocused();
    await panel(page).getByTestId("voice-discard").click();
    await expect(panel(page).getByTestId("voice-record")).toBeFocused();

    await panel(page).getByTestId("voice-record").click();
    await panel(page).getByTestId("voice-cancel").click();
    await expect(panel(page).getByTestId("voice-record")).toBeFocused();
  });

  test("la región de estado existe siempre y anuncia el inicio y el fin de la grabación", async ({
    page,
  }) => {
    await simular(page, { text: "¿Qué día es hoy?", quality: "ok" });
    const vivo = panel(page).getByTestId("voice-status");
    await expect(vivo).toBeAttached();
    await expect(vivo).toHaveText("");
    await panel(page).getByTestId("voice-record").click();
    await expect(vivo).toHaveText("Grabando y conservando audio");
    await page.waitForTimeout(1500);
    await panel(page).getByTestId("voice-stop").click();
    await expect(vivo).toContainText("Grabación detenida");
  });

  test("con una respuesta en curso, enviar el audio avisa y no lo pierde", async ({ page }) => {
    await simular(page, { text: "¿Qué día es hoy?", quality: "ok" });
    await page.route("**/rest/v1/rpc/search_knowledge_fragments", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      await route.continue();
    });
    await panel(page)
      .getByTestId("composer-input")
      .fill(`¿Protocolo de prueba ocupado ${Date.now()}?`);
    await panel(page).getByTestId("composer-send").click();
    await expect(panel(page).getByTestId("composer-stop")).toBeVisible();

    await grabar(page, 1500);
    await panel(page).getByTestId("voice-send").click();
    await expect(panel(page).getByTestId("voice-notice")).toContainText("respuesta en curso");
    // El audio sigue en revisión para enviarlo cuando termine.
    await expect(panel(page).getByTestId("voice-send")).toBeVisible();
  });

  test("una grabación de menos de 1 s no se envía y se avisa", async ({ page }) => {
    const c = await simular(page, { text: "no debe llegar", quality: "ok" });
    await panel(page).getByTestId("voice-record").click();
    await panel(page).getByTestId("voice-stop").click();
    await expect(panel(page).getByTestId("voice-notice")).toContainText("demasiado corta");
    expect(c.subidas).toBe(0);
    await expect(panel(page).getByTestId("message-user")).toHaveCount(0);
  });

  test("«Cancelar» durante la grabación no deja nada", async ({ page }) => {
    const c = await simular(page, { text: "no debe llegar", quality: "ok" });
    await panel(page).getByTestId("voice-record").click();
    await page.waitForTimeout(500);
    await panel(page).getByTestId("voice-cancel").click();
    await expect(panel(page).getByTestId("voice-panel")).toHaveCount(0);
    await expect(panel(page).getByTestId("voice-record")).toBeEnabled();
    expect(c.subidas).toBe(0);
  });

  test("«Descartar» en revisión no sube ni envía nada", async ({ page }) => {
    const c = await simular(page, { text: "no debe llegar", quality: "ok" });
    await grabar(page, 1500);
    await panel(page).getByTestId("voice-discard").click();
    await expect(panel(page).getByTestId("voice-panel")).toHaveCount(0);
    expect(c.subidas).toBe(0);
    expect(c.transcripciones).toBe(0);
  });

  test("con un audio ininteligible dice «No se entendió», ofrece grabar de nuevo y no responde", async ({
    page,
  }) => {
    const c = await simular(page, { text: "", quality: "insufficient" });
    await grabar(page, 1500);
    await panel(page).getByTestId("voice-send").click();
    await expect(panel(page).getByTestId("voice-notice")).toContainText("No se entendió", {
      timeout: 15_000,
    });
    await expect(panel(page).getByTestId("voice-notice")).toContainText("grabar de nuevo");
    await expect(panel(page).getByTestId("message-user")).toHaveCount(0);
    await expect(panel(page).getByTestId("message-assistant")).toHaveCount(0);
    // El audio subido para transcribir se borra: no queda un objeto sin mensaje.
    expect(c.subidas).toBe(1);
    await expect.poll(() => c.borrados).toBe(1);
    await expect(panel(page).getByTestId("voice-record")).toBeEnabled();
  });

  test("si la transcripción falla, vuelve a la revisión con el mismo audio para reintentar", async ({
    page,
  }) => {
    await page.route("**/functions/v1/transcribe-chat-audio", (route) =>
      responder(route, 502, { code: "PROVIDER_ERROR" }),
    );
    await page.route("**/storage/v1/object/assistant-audio/**", (route) =>
      responder(route, 200, { Key: "x", Id: "x" }),
    );
    await page.route("**/storage/v1/object/assistant-audio", (route) => responder(route, 200, []));
    await grabar(page, 1500);
    await panel(page).getByTestId("voice-send").click();
    await expect(panel(page).getByTestId("voice-send")).toBeVisible({ timeout: 15_000 });
    await expect(panel(page).getByTestId("voice-panel")).toContainText("Revisa tu mensaje de voz");
    await expect(panel(page).getByTestId("message-user")).toHaveCount(0);
  });

  test("«Eliminar audio» pide confirmación y la transcripción permanece", async ({ page }) => {
    const c = await simular(page, { text: "¿Qué día es hoy?", quality: "ok" });
    await grabar(page, 1500);
    await panel(page).getByTestId("voice-send").click();
    await expect(panel(page).getByTestId("message-user")).toContainText("Audio ·", {
      timeout: 15_000,
    });

    await panel(page).getByTestId("message-remove-audio").click();
    await expect(panel(page).getByTestId("audio-remove-confirm")).toContainText(
      "transcripción permanece",
    );
    await panel(page).getByTestId("audio-remove-no").click();
    await expect(panel(page).getByTestId("message-user")).toContainText("Audio ·");

    await panel(page).getByTestId("message-remove-audio").click();
    await panel(page).getByTestId("audio-remove-yes").click();
    await expect(panel(page).getByTestId("message-user")).toContainText("audio eliminado");
    await expect(panel(page).getByTestId("message-user")).toContainText("¿Qué día es hoy?");
    await expect(panel(page).getByTestId("message-remove-audio")).toHaveCount(0);
    await expect.poll(() => c.borrados).toBeGreaterThan(0);
    const filas = await api.get(
      "/rest/v1/assistant_messages?select=audio_path&audio_path=not.is.null",
    );
    expect(await filas.json()).toEqual([]);
  });

  // chat-del-asistente 8.1: grabando, revisión, aviso y un mensaje con audio no tienen violaciones axe.
  test("los estados de voz no tienen violaciones axe (WCAG 2.2 AA)", async ({ page }) => {
    await simular(page, { text: "¿Qué día es hoy?", quality: "ok" });
    // El título del documento lo pone la pantalla al hidratar: sin esperarlo, axe (`document-title`) corre antes.
    await expect(page).toHaveTitle(/Diklass/);
    await expect(panel(page).getByTestId("composer-input")).toBeVisible();
    await sinViolaciones(page);

    await panel(page).getByTestId("voice-record").click();
    await expect(panel(page).getByTestId("voice-panel")).toBeVisible();
    await sinViolaciones(page);

    await page.waitForTimeout(1500);
    await panel(page).getByTestId("voice-stop").click();
    await expect(panel(page).getByTestId("voice-send")).toBeVisible();
    await sinViolaciones(page);

    await panel(page).getByTestId("voice-send").click();
    await expect(panel(page).getByTestId("message-play-audio")).toBeVisible({ timeout: 15_000 });
    await sinViolaciones(page);

    await panel(page).getByTestId("message-remove-audio").click();
    await expect(panel(page).getByTestId("audio-remove-confirm")).toBeVisible();
    await sinViolaciones(page);
    await panel(page).getByTestId("audio-remove-no").click();

    // Aviso de primer uso (el audio va a un proveedor externo).
    await consentimientoDeVoz(page, false);
    await page.reload();
    await panel(page).getByTestId("voice-record").click();
    await expect(panel(page).getByTestId("voice-consent")).toBeVisible();
    await sinViolaciones(page);
    await panel(page).getByTestId("voice-consent-cancel").click();
    await consentimientoDeVoz(page, true);
    await page.reload();

    // Aviso (grabación demasiado corta).
    await panel(page).getByTestId("voice-record").click();
    await panel(page).getByTestId("voice-stop").click();
    await expect(panel(page).getByTestId("voice-notice")).toBeVisible();
    await sinViolaciones(page);
  });

  test("reproducir un audio enviado pide una URL firmada al pulsar", async ({ page }) => {
    const c = await simular(page, { text: "¿Qué día es hoy?", quality: "ok" });
    await grabar(page, 1500);
    await panel(page).getByTestId("voice-send").click();
    await expect(panel(page).getByTestId("message-play-audio")).toBeVisible({ timeout: 15_000 });
    expect(c.firmas).toBe(0);
    await panel(page).getByTestId("message-play-audio").click();
    await expect.poll(() => c.firmas).toBe(1);
  });
});

test.describe("un solo micrófono: la escucha de la consulta y el chat", () => {
  test.skip(
    process.env.EXPO_PUBLIC_VOZ_MODO === "real",
    "App exportada con voz real: usa modo-escucha-real.spec.ts.",
  );
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");

  test("con la escucha de la consulta activa el botón de grabar queda deshabilitado y lo explica", async ({
    page,
  }) => {
    const { api, patientId, crear } = await prepararPaciente(page, "Rocky E2E un micrófono");
    try {
      await consentimientoDeVoz(page, true);
      const consultationId = await crear("consultation", { patientId, status: "open" });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/consultations/${consultationId}`);
      await expect(page.getByTestId("anamnesis-section")).toBeVisible({ timeout: 15_000 });

      await abrirHilo(page, "asistente");
      const panel = page.getByTestId("assistant-panel");
      await expect(panel.getByTestId("voice-record")).toBeEnabled();

      await abrirHilo(page, "escucha");
      await page.getByRole("button", { name: "Modo de escucha" }).click();
      await expect(page.getByTestId("transcript-segment").first()).toBeVisible({ timeout: 15_000 });

      await abrirHilo(page, "asistente");
      await expect(panel.getByTestId("voice-record")).toBeDisabled();
      await expect(panel.getByTestId("voice-blocked")).toContainText(
        "La escucha de la consulta usa el micrófono.",
      );
    } finally {
      await api.dispose();
    }
  });
});
