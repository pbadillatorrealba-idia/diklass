import { type APIRequestContext, request as apiRequest, type Page } from "@playwright/test";
import { checkpointApiConversation } from "../../support/test-network";
import { provisionClinicalCase, type SyntheticCase } from "./caso-sintetico";
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
import { abrirHilo } from "./panel";

// asistente-conversacional (chat-del-asistente, tareas 4.4 · 4.5 · 4.6 · 3.3).
test.describe("chat del asistente", () => {
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");

  let caso: SyntheticCase = { patientId: "", openConsultationId: "", closedConsultationId: "" };
  let api: APIRequestContext;
  let userId = "";
  let clinicId = "";

  test.beforeAll(async ({ browser }) => {
    caso = await provisionClinicalCase(browser);
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    const session = await readSupabaseSession(page);
    userId = session.userId;
    api = await apiRequest.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const perfil = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
    clinicId = ((await perfil.json()) as Array<{ clinic_id: string }>)[0]?.clinic_id ?? "";
    // Cada prueba parte de una conversación vacía.
    await checkpointApiConversation(api);
    await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
    await page.reload();
  });

  test.afterEach(async () => {
    await checkpointApiConversation(api);
    await api.post("/rest/v1/rpc/delete_assistant_conversation", { data: {} });
    await api.dispose();
  });

  const panel = (page: Page) => page.getByTestId("assistant-panel");
  const preguntar = async (page: Page, texto: string) => {
    await panel(page).getByTestId("composer-input").fill(texto);
    await panel(page).getByTestId("composer-send").click();
  };
  /** Siembra mensajes de a uno para que su `created_at` (fijado por el servidor) sea creciente. */
  const sembrar = async (cantidad: number) => {
    for (let i = 1; i <= cantidad; i++) {
      const respuesta = await api.post("/rest/v1/assistant_messages", {
        data: {
          clinic_id: clinicId,
          author_id: userId,
          role: i % 2 ? "user" : "assistant",
          status: "done",
          parts: [{ type: "text", text: `sembrado ${i}` }],
        },
      });
      expect(respuesta.ok()).toBe(true);
    }
  };
  const mensajes = (page: Page) => panel(page).getByTestId(/^message-(user|assistant)$/);
  const listaMetrics = (page: Page) =>
    panel(page)
      .getByTestId("message-list")
      .evaluate((el) => ({
        top: el.scrollTop,
        cerca: el.scrollHeight - el.scrollTop - el.clientHeight <= 32,
      }));

  test("la conversación sigue tras recargar", async ({ page }) => {
    await preguntar(page, "¿Qué día es hoy?");
    await expect(mensajes(page)).toHaveCount(2, { timeout: 15_000 });
    await page.reload();
    await expect(mensajes(page)).toHaveCount(2, { timeout: 15_000 });
    await expect(panel(page).getByTestId("message-assistant")).toContainText(/Hoy es/);
  });

  test("borrar la conversación pide confirmación y declara que la auditoría permanece", async ({
    page,
  }) => {
    await preguntar(page, "¿Qué día es hoy?");
    await expect(mensajes(page)).toHaveCount(2, { timeout: 15_000 });

    await panel(page).getByTestId("chat-clear").click();
    await expect(panel(page).getByTestId("chat-clear-confirm")).toContainText("auditoría");
    // Acción destructiva: el foco entra en «Cancelar» y vuelve al disparador al cancelar.
    await expect(panel(page).getByRole("alertdialog")).toHaveAccessibleName(
      "Confirmar el borrado de la conversación",
    );
    await expect(panel(page).getByTestId("chat-clear-no")).toBeFocused();
    await panel(page).getByTestId("chat-clear-no").click();
    await expect(panel(page).getByTestId("chat-clear")).toBeFocused();
    await expect(mensajes(page)).toHaveCount(2);

    await panel(page).getByTestId("chat-clear").click();
    await panel(page).getByTestId("chat-clear-yes").click();
    await expect(mensajes(page)).toHaveCount(0, { timeout: 15_000 });
    await expect(panel(page)).toContainText("Aún no hay mensajes");
  });

  test("con el panel colapsado, la respuesta marca el riel como no leído hasta abrir el asistente", async ({
    page,
  }) => {
    // La persistencia tarda, así que da tiempo a colapsar el panel antes de que llegue la respuesta.
    await page.route(/assistant_messages/, async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await preguntar(page, "¿Qué día es hoy?");
    await panel(page).getByTestId("assistant-toggle").click();
    const marca = page.getByTestId("assistant-rail-unread-asistente");
    await expect(marca).toBeVisible({ timeout: 15_000 });
    await expect(marca).toHaveAttribute("role", "status");
    await expect(marca).toContainText("Nuevo");

    await abrirHilo(page, "asistente");
    await expect(marca).toHaveCount(0);
  });

  test("Cargar anteriores trae lo anterior sin mover lo que se leía", async ({ page }) => {
    await sembrar(60);
    await page.reload();
    await expect(mensajes(page)).toHaveCount(50, { timeout: 15_000 });
    // Abre anclada al final.
    expect((await listaMetrics(page)).cerca).toBe(true);
    await expect(panel(page).getByTestId("go-to-end")).toHaveCount(0);

    await panel(page)
      .getByTestId("message-list")
      .evaluate((el) => {
        el.scrollTop = 0;
      });
    const primero = mensajes(page).first();
    const texto = await primero.innerText();
    const antes = (await primero.boundingBox())?.y ?? -1;

    await panel(page).getByTestId("load-older").click();
    await expect(mensajes(page)).toHaveCount(60, { timeout: 15_000 });
    const marca = texto.match(/sembrado \d+/)?.[0] ?? "";
    const mismo = mensajes(page)
      .filter({ hasText: new RegExp(`${marca}(?!\\d)`) })
      .first();
    // El ajuste de posición ocurre en el siguiente cuadro, tras medir el contenido nuevo.
    await expect
      .poll(async () => Math.abs(((await mismo.boundingBox())?.y ?? -2) - antes))
      .toBeLessThan(24);
    await expect(panel(page).getByTestId("load-older")).toHaveCount(0);
  });

  test("una respuesta nueva no arrastra a quien lee arriba y ofrece «Ir al final»", async ({
    page,
  }) => {
    await sembrar(30);
    await page.reload();
    await expect(mensajes(page)).toHaveCount(30, { timeout: 15_000 });
    await page.route(/assistant_messages/, async (route) => {
      if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await preguntar(page, "¿Qué día es hoy?");
    // Enviar lleva la lista al final; solo entonces el veterinario sube a leer.
    await expect(panel(page).getByText("Enviando…")).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => (await listaMetrics(page)).cerca).toBe(true);
    // El veterinario sube a leer mientras llega la respuesta.
    await panel(page)
      .getByTestId("message-list")
      .evaluate((el) => {
        el.scrollTop = 0;
      });
    const ir = panel(page).getByTestId("go-to-end");
    await expect(ir).toContainText("1 nuevo", { timeout: 15_000 });
    expect((await listaMetrics(page)).top).toBeLessThan(8);

    await ir.getByRole("button").click();
    await expect(ir).toHaveCount(0);
    expect((await listaMetrics(page)).cerca).toBe(true);
  });

  test("«Detener» no aparece cuando no hay respuesta en curso y el envío exige texto", async ({
    page,
  }) => {
    await expect(panel(page).getByTestId("composer-stop")).toHaveCount(0);
    await expect(panel(page).getByTestId("composer-send")).toBeDisabled();
  });

  // «Paciente de contexto automático»: lo fija la navegación y se suelta al salir de la pantalla.
  test("el paciente de contexto lo fija la ficha y se suelta al volver al inicio", async ({
    page,
  }) => {
    await expect(panel(page).getByTestId("chat-context")).toHaveCount(0);

    await page.goto(`/patients/${caso.patientId}`);
    await expect(panel(page).getByTestId("chat-context")).toHaveText("Contexto: Cholito", {
      timeout: 15_000,
    });
    // Sin selector de pacientes: la etiqueta es de solo lectura.
    await expect(panel(page).getByRole("radiogroup")).toHaveCount(0);

    // Navegación dentro de la app (sin recargar): al salir, el contexto se suelta.
    await page.getByRole("link", { name: "Inicio" }).first().click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(panel(page).getByTestId("chat-context")).toHaveCount(0);
  });

  // Hallazgo 5 de la revisión: «Detener» corta al instante aunque la red tarde; la pregunta se conserva
  // y se puede volver a preguntar sin esperar.
  test("«Detener» corta una consulta lenta al instante y deja la pregunta", async ({ page }) => {
    await page.route("**/rest/v1/rpc/search_knowledge_fragments", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      await route.continue();
    });
    await preguntar(page, `¿Protocolo de prueba de detener ${Date.now()}?`);
    await expect(panel(page).getByTestId("composer-stop")).toBeVisible();
    await expect(panel(page).getByText("Pensando…").first()).toBeVisible();

    await panel(page).getByTestId("composer-stop").click();
    // Al instante: sin esperar a los 4 s de la red.
    await expect(panel(page).getByTestId("composer-stop")).toHaveCount(0, { timeout: 2_000 });
    await expect(panel(page).getByText("Pensando…")).toHaveCount(0);
    await expect(mensajes(page)).toHaveCount(1, { timeout: 5_000 });
    await expect(panel(page).getByTestId("message-user")).toBeVisible();

    // Se puede volver a preguntar de inmediato.
    await preguntar(page, "¿Qué día es hoy?");
    await expect(panel(page).getByTestId("message-assistant").last()).toContainText(/Hoy es/, {
      timeout: 15_000,
    });
  });
});
