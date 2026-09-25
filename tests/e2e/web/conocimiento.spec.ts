import { type APIRequestContext, request as apiRequest, type Page } from "@playwright/test";
import {
  ANA,
  expect,
  readSupabaseSession,
  SERVICE_ROLE_KEY,
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

/** Id de la sesión de Auth del token: identifica solo la sesión de acceso de esta página. */
function authSessionIdDe(accessToken: string): string {
  const { session_id } = JSON.parse(
    Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8"),
  ) as { session_id?: string };
  if (!session_id) throw new Error("El token de acceso no trae el claim session_id.");
  return session_id;
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
  // RI-2: la base de conocimiento se alcanza desde el panel clínico, no solo por URL.
  test("el panel clínico enlaza con la base de conocimiento", async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 10_000 });

    await page.getByTestId("home-knowledge").click();

    await expect(page).toHaveURL(/\/knowledge$/);
    await expect(
      page.getByLabel("Tu pregunta al asistente").filter({ visible: true }),
    ).toBeVisible();
  });

  // Tarea 7.12: con la sesión de acceso caducada la RLS devuelve cero filas, no un error, y el
  // visor mostraba «no encontrada» en vez de pedir que se vuelva a iniciar sesión.
  test("con la sesión de acceso caducada el visor pide reautenticación, no «no encontrada»", async ({
    page,
  }) => {
    test.skip(!SERVICE_ROLE_KEY, "Necesita la service role para envejecer la sesión de acceso.");
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 10_000 });
    const { accessToken, userId } = await readSupabaseSession(page);
    const authSessionId = authSessionIdDe(accessToken);
    const titulo = `Guía E2E de sesión caducada ${Date.now()}`;

    // La fuente se incorpora con el token de Ana: los triggers sellan la atribución con auth.uid().
    const ana = await apiRequest.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const admin = await apiRequest.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SERVICE_ROLE_KEY as string,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    try {
      const vet = await ana.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
      const [{ clinic_id: clinicId } = { clinic_id: "" }] = (await vet.json()) as Array<{
        clinic_id: string;
      }>;
      if (!clinicId) throw new Error("No se encontró la clínica del veterinario.");
      const incorporada = await ana.post("/rest/v1/knowledge_documents", {
        data: {
          clinic_id: clinicId,
          status: "available",
          content: {
            bibliografia: {
              titulo,
              autores: ["Dra. Ficticia"],
              anio: 2026,
              revista: null,
              editorial: null,
              edicion: null,
              doi: null,
              url: null,
            },
            licencia: { tipo: "CC BY 4.0 (ficticia)", nota: null },
            fragmentos: [{ ordinal: 1, seccion: null, texto: "Fragmento sintético de la prueba." }],
          },
        },
        headers: { Prefer: "return=representation" },
      });
      expect(incorporada.ok()).toBeTruthy();
      const [fuente] = (await incorporada.json()) as Array<{ id: string }>;
      if (!fuente) throw new Error("La fuente incorporada no volvió en la representación.");

      await page.goto("/knowledge/sources");
      const verFuente = page.getByTestId(`ver-fuente-${fuente.id}`).filter({ visible: true });
      await expect(verFuente).toBeVisible();

      // Aísla el visor del rastreador de actividad: el clic tocaría la sesión, recibiría
      // «inactiva» y abriría el diálogo por su cuenta, ocultando lo que se prueba aquí.
      await page.route("**/rest/v1/rpc/touch_access_session", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: "true" }),
      );
      // Envejece solo la sesión de acceso de esta página, como ocho horas de inactividad.
      const ahora = Date.now();
      const envejecida = await admin.patch(
        `/rest/v1/access_sessions?auth_session_id=eq.${authSessionId}&revoked_at=is.null`,
        {
          data: {
            last_activity_at: new Date(ahora - 9 * 3_600_000).toISOString(),
            expires_at: new Date(ahora - 3_600_000).toISOString(),
          },
          headers: { Prefer: "return=representation" },
        },
      );
      expect(envejecida.ok()).toBeTruthy();
      expect((await envejecida.json()) as unknown[]).toHaveLength(1);

      await verFuente.click();
      await expect(page).toHaveURL(new RegExp(`/knowledge/sources/${fuente.id}`));
      await expect(page.getByText("Sesión expirada")).toBeVisible();
      await expect(page.getByTestId("fuente-no-encontrada")).toBeHidden();
    } finally {
      await ana.dispose();
      await admin.dispose();
    }
  });
});
