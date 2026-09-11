import { request as apiRequest } from "@playwright/test";
import {
  ANA,
  expect,
  hasBackend,
  readSupabaseSession,
  SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  submitLogin,
  test,
} from "./fixtures";

const backendOnly = "Requires local Supabase with the synthetic veterinarians provisioned.";

test.describe("auth web shell", () => {
  test("shows the accessible login without a registration path", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Diklass" })).toBeVisible();
    await expect(page.getByLabel("Correo de acceso")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByText(/registr/i)).toHaveCount(0);
  });

  test("uses client-side validation before any credential request", async ({ page }) => {
    await page.goto("/login");
    const submit = page.getByRole("button", { name: "Iniciar sesión" });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByTestId("login-error")).toHaveText(
      "Revisa los campos marcados antes de continuar.",
    );
  });

  // T071: what an axe scan cannot check — focus movement and the error announcement.
  test("keyboard focus follows email, password, submit and a failure is announced", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Correo de acceso").click();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Contraseña")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeFocused();

    await page.keyboard.press("Enter");
    const error = page.getByTestId("login-error");
    await expect(error).toHaveText("Revisa los campos marcados antes de continuar.");
    await expect(error).toHaveAttribute("aria-live", "polite");
  });

  test("denies a direct protected route without an authenticated session", async ({ page }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("auth against the local backend", () => {
  test.skip(!hasBackend, backendOnly);

  test("a provisioned veterinarian is identified and ready in under 30 s (US11/AC1, SC-043)", async ({
    page,
  }) => {
    const startedAt = Date.now();
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    await expect(page.getByTestId("authenticated-identity")).toHaveText(
      `Sesión activa: ${ANA.displayName}`,
    );
    expect(Date.now() - startedAt).toBeLessThan(30_000);
  });

  test("a wrong password and an unknown identifier are indistinguishable (US11/AC2-3, SC-046)", async ({
    page,
  }) => {
    const attempt = async (email: string, password: string) => {
      const tokenResponse = page.waitForResponse((response) =>
        response.url().includes("/auth/v1/token"),
      );
      await submitLogin(page, { email, password });
      const response = await tokenResponse;
      const body = (await response.json()) as { error_code?: string; msg?: string };
      const error = page.getByTestId("login-error");
      await expect(error).toBeVisible();
      return {
        status: response.status(),
        errorCode: body.error_code,
        providerMessage: body.msg,
        shownMessage: await error.textContent(),
      };
    };

    const wrongPassword = await attempt(ANA.email, "not-the-right-password");
    const unknownAccount = await attempt("nobody.here@example.test", "not-the-right-password");

    expect(wrongPassword.shownMessage).toBe("Identificador o contraseña incorrectos.");
    expect(unknownAccount).toEqual(wrongPassword);
  });

  test("after logout the previous session cannot operate (US11/AC4, SC-039)", async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    const { accessToken, userId } = await readSupabaseSession(page);

    const api = await apiRequest.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    try {
      const profile = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${userId}`);
      const [anaProfile] = (await profile.json()) as Array<{ clinic_id: string }>;
      if (!anaProfile) {
        throw new Error("Could not read the veterinarian profile before logging out.");
      }
      const clinicId = anaProfile.clinic_id;

      await page.getByTestId("logout-button").click();
      await expect(page).toHaveURL(/\/login$/);

      // The captured token is still a valid JWT; the revoked access session is what stops it.
      const read = await api.get("/rest/v1/clinical_records?select=id");
      expect(await read.json()).toEqual([]);
      const write = await api.post("/rest/v1/clinical_records", {
        data: { clinic_id: clinicId, record_type: "patient", content: {}, status: "draft" },
      });
      expect(write.ok()).toBeFalsy();

      await page.goto("/home");
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await api.dispose();
    }
  });

  test("unsaved notes survive an expired session and return after reauthentication (US11/AC5, SC-047)", async ({
    page,
  }) => {
    test.skip(!SERVICE_ROLE_KEY, "Needs the service role to age the session past eight hours.");
    const consultationId = crypto.randomUUID();
    const notes = "Luna tolera mejor la separación con enriquecimiento ambiental.";

    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    const { accessToken } = await readSupabaseSession(page);
    // Age only this page's access session: other tests hold Ana's sessions in parallel (D1).
    const authSessionId = (
      JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as {
        session_id?: string;
      }
    ).session_id;
    if (!authSessionId) {
      throw new Error("The access token carries no session_id claim.");
    }

    await page.goto(`/consultations/${consultationId}`);
    const notesField = page.getByLabel("Notas de la consulta");
    await notesField.click();
    await page.keyboard.type(notes, { delay: 5 });
    await expect(notesField).toHaveValue(notes);
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(window.sessionStorage).some((key) => key.startsWith("diklass:draft:")),
        ),
      )
      .toBe(true);

    const admin = await apiRequest.newContext({
      baseURL: SUPABASE_URL,
      extraHTTPHeaders: {
        apikey: SERVICE_ROLE_KEY as string,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    try {
      // Age the live session past the inactivity limit, as eight idle hours would.
      const now = Date.now();
      const aged = await admin.patch(
        `/rest/v1/access_sessions?auth_session_id=eq.${authSessionId}&revoked_at=is.null`,
        {
          data: {
            last_activity_at: new Date(now - 9 * 3_600_000).toISOString(),
            expires_at: new Date(now - 3_600_000).toISOString(),
          },
        },
      );
      expect(aged.ok()).toBeTruthy();

      await page.getByRole("button", { name: "Guardar anamnesis" }).click();
      await expect(page.getByText("Sesión expirada")).toBeVisible();
      await expect(page.getByTestId("consultation-status")).toHaveText(
        "La sesión ya no es válida. El borrador se conservó.",
      );

      const history = await admin.get(
        `/rest/v1/clinical_records?select=id&content->>consultationId=eq.${consultationId}`,
      );
      expect(await history.json()).toEqual([]);

      await page.getByRole("button", { name: "Volver a iniciar sesión" }).click();
      await expect(page).toHaveURL(/\/login$/);
      await submitLogin(page, ANA);
      await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });

      await page.goto(`/consultations/${consultationId}`);
      await expect(page.getByLabel("Notas de la consulta")).toHaveValue(notes);
      await expect(page.getByTestId("consultation-status")).toHaveText(
        "Se recuperó un borrador no guardado.",
      );

      await page.getByRole("button", { name: "Guardar anamnesis" }).click();
      await expect(page.getByTestId("consultation-status")).toHaveText("Anamnesis guardada.");
      await expect(page.getByTestId("attribution-badge")).toContainText(ANA.displayName);
      await expect
        .poll(() =>
          page.evaluate(() =>
            Object.keys(window.sessionStorage).some((key) => key.startsWith("diklass:draft:")),
          ),
        )
        .toBe(false);
    } finally {
      await admin.dispose();
    }
  });
});
