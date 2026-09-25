import { type APIRequestContext, request as apiRequest, type Page } from "@playwright/test";
import {
  ANA,
  expect,
  readSupabaseSession,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  submitLogin,
  test,
} from "./fixtures";

/**
 * Base de conocimiento en web (revisión de la PR #30). La navegación entre pantallas se hace
 * dentro de la app (botones y `goBack`), no con `page.goto`, que recargaría la página y
 * vaciaría la caché de React Query que estas pruebas vigilan.
 */
async function iniciarSesion(page: Page): Promise<APIRequestContext> {
  await submitLogin(page, ANA);
  await expect(page).toHaveURL(/\/home$/, { timeout: 10_000 });
  const session = await readSupabaseSession(page);
  return apiRequest.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

async function escribir(page: Page, etiqueta: string, texto: string) {
  const campo = page.getByLabel(etiqueta).filter({ visible: true });
  await expect(campo).toBeEditable();
  await campo.click();
  await page.keyboard.type(texto, { delay: 5 });
  await expect(campo).toHaveValue(texto);
}

test.describe("base de conocimiento web", () => {
  test.beforeEach(() => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  // Hallazgo 5: con el staleTime global de 30 s, la colección salía de caché sin la fuente
  // recién incorporada y con la retirada aún «disponible».
  test("la colección refleja al momento la fuente incorporada y su retiro confirmado", async ({
    page,
  }) => {
    const api = await iniciarSesion(page);
    const titulo = `Guía E2E de colección ${Date.now()}`;
    try {
      await page.goto("/knowledge/sources");
      await expect(page.getByText("Base de conocimiento · Colección")).toBeVisible();
      // La lista ya está en caché antes de incorporar.
      await expect(page.getByRole("button", { name: "Incorporar fuente clínica" })).toBeVisible();

      await page.getByRole("button", { name: "Incorporar fuente clínica" }).click();
      await escribir(page, "Título de la fuente", titulo);
      // La licencia viene precargada con «CC BY 4.0 (ficticia)».
      await escribir(page, "Texto del documento", "Fragmento sintético para la prueba de caché.");
      await page.getByTestId("fuente-submit").click();

      await expect(page).toHaveURL(/\/knowledge\/sources$/);
      await expect(page.getByText(titulo).filter({ visible: true })).toBeVisible({
        timeout: 5_000,
      });

      const consulta = await api.get(
        `/rest/v1/knowledge_documents?select=id&content->bibliografia->>titulo=eq.${encodeURIComponent(titulo)}`,
      );
      const [fuente] = (await consulta.json()) as Array<{ id: string }>;
      if (!fuente) throw new Error("La fuente incorporada no aparece en la Data API.");

      await page.getByTestId(`ver-fuente-${fuente.id}`).filter({ visible: true }).click();
      await expect(page).toHaveURL(new RegExp(`/knowledge/sources/${fuente.id}`));

      // Hallazgo 9: el retiro es irreversible y pide confirmación antes de ejecutarse.
      await page.getByTestId("retirar-fuente").click();
      await expect(page.getByTestId("confirmar-retiro")).toBeVisible();
      const antes = await api.get(`/rest/v1/knowledge_documents?select=status&id=eq.${fuente.id}`);
      expect(await antes.json()).toEqual([{ status: "available" }]);
      await page.getByTestId("confirmar-retiro").click();
      await expect(page.getByTestId("fuente-status")).toHaveText(/Fuente retirada/);

      await page.goBack();
      await expect(page).toHaveURL(/\/knowledge\/sources$/);
      await expect(
        page.getByTestId(`fuente-estado-${fuente.id}`).filter({ visible: true }),
      ).toHaveText("Fuente retirada de la colección", { timeout: 5_000 });
    } finally {
      await api.dispose();
    }
  });

  // Hallazgo 9: con una fuente inexistente, o una lectura fallida, la pantalla se quedaba en
  // «Cargando la fuente…» para siempre.
  test("una fuente inexistente o ilegible no deja la pantalla cargando", async ({ page }) => {
    const api = await iniciarSesion(page);
    try {
      await page.goto("/knowledge/sources/00000000-0000-4000-8000-00000000dead");
      await expect(page.getByTestId("fuente-no-encontrada")).toBeVisible();
      await expect(page.getByText("Cargando la fuente…")).toBeHidden();

      await page.goto("/knowledge/sources/no-es-un-uuid");
      await expect(page.getByTestId("fuente-error")).toBeVisible();
      await expect(page.getByText("Cargando la fuente…")).toBeHidden();
    } finally {
      await api.dispose();
    }
  });

  // Hallazgo 6: Enter no respetaba la consulta en curso y registraba dos filas append-only.
  test("pulsar Enter otra vez con la consulta en curso registra una sola consulta", async ({
    page,
  }) => {
    const api = await iniciarSesion(page);
    const pregunta = `¿Protocolo E2E de doble envío ${Date.now()}?`;
    try {
      // La recuperación tarda 1,5 s: da tiempo a un segundo Enter mientras está en curso.
      await page.route("**/rest/v1/rpc/search_knowledge_fragments", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        await route.continue();
      });
      await page.goto("/knowledge");
      await escribir(page, "Tu pregunta al asistente", pregunta);
      const campo = page.getByLabel("Tu pregunta al asistente").filter({ visible: true });
      await page.keyboard.press("Enter");
      // En web, Enter quita el foco del campo: el veterinario vuelve a él y repite.
      await campo.click();
      await page.keyboard.press("Enter");

      await expect(page.getByText(pregunta, { exact: true }).filter({ visible: true })).toHaveCount(
        1,
      );
      // Enter con la pregunta ya vaciada tampoco dispara otra consulta ni un error.
      await campo.click();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1_000);

      const registradas = await api.get(
        `/rest/v1/knowledge_queries?select=id&question=eq.${encodeURIComponent(pregunta)}`,
      );
      expect(await registradas.json()).toHaveLength(1);
      await expect(page.getByText(pregunta, { exact: true }).filter({ visible: true })).toHaveCount(
        1,
      );
      await expect(page.getByTestId("conocimiento-status")).toBeHidden();
    } finally {
      await api.dispose();
    }
  });
});
