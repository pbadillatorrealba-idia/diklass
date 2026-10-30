import AxeBuilder from "@axe-core/playwright";
import { provisionClinicalCase } from "./caso-sintetico";
import { ANA, expect, hasBackend, submitLogin, test } from "./fixtures";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// Canales de `--background` en `global.css`: el token que pinta el fondo de toda la app.
const DARK_BACKGROUND = "20 18 28";
const LIGHT_BACKGROUND = "241 240 246";

const background = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
  );

// sistema-visual US16 · FR-091 · FR-094 · SC-058 (design.md D17).
test.describe("tema manual, calendario de Inicio y Configuración", () => {
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");
  test.use({ colorScheme: "light" });

  test.beforeAll(async ({ browser }) => {
    await provisionClinicalCase(browser);
  });

  test.beforeEach(async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  });

  test("la cápsula móvil flota a la derecha sin tapar contenido y devuelve el foco al cerrar", async ({
    page,
  }) => {
    await page.goto("/settings");
    for (const width of [320, 375, 768]) {
      await page.setViewportSize({ width, height: 900 });
      const capsule = page.getByTestId("panel-dock-open");
      await expect(capsule.getByText("Asistente", { exact: true })).toBeVisible();
      const box = await capsule.boundingBox();
      const tabs = await page.getByTestId("app-tabbar").boundingBox();
      const scroll = await page.getByTestId("settings-screen-scroll").boundingBox();
      if (!scroll || !tabs) throw new Error("Falta el desplazamiento o la navegación");
      expect(scroll.y + scroll.height).toBe(tabs.y);
      if (!box || !tabs) throw new Error("Falta la cápsula o la navegación");
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(width - box.x - box.width).toBe(16);
      expect(tabs.y - box.y - box.height).toBe(16);
      const style = await capsule.evaluate((el) => {
        const css = getComputedStyle(el);
        return { radius: parseFloat(css.borderTopLeftRadius), background: css.backgroundColor };
      });
      expect(style.radius).toBeGreaterThanOrEqual(box.height / 2);
      expect(style.background).not.toBe("rgba(0, 0, 0, 0)");
      const blocksContent = await page.evaluate(
        ({ y }) =>
          Boolean(document.elementFromPoint(8, y + 22)?.closest('[data-testid="panel-dock"]')),
        box,
      );
      expect(blocksContent).toBe(false);
      const bar = page.getByTestId("screen-action-bar");
      await expect(bar).toHaveCSS("position", "absolute");
      await expect(bar).toHaveCSS("border-top-width", "0px");
      await expect(bar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      const logout = page.getByTestId("settings-session").getByTestId("logout-button");
      // Al final del contenido: ahí el relleno inferior debe dejar el último control sobre la cápsula.
      const scroller = page.getByTestId("settings-screen-scroll");
      await scroller.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect
        .poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop))
        .toBeLessThanOrEqual(1);
      const last = await logout.boundingBox();
      if (!last) throw new Error("Falta el cierre de sesión");
      expect(last.y + last.height).toBeLessThanOrEqual(box.y);
      await capsule.click();
      await expect(page.getByRole("dialog", { name: "Asistente", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "Asistente", exact: true })).toHaveCount(0);
      await expect(capsule).toBeFocused();
    }
    await page.getByTestId("dock-start-consultation").click();
    await expect(page).toHaveURL(/\/patients$/);
    await page.goto("/knowledge");
    await expect(page.getByTestId("panel-dock-open")).toHaveCount(0);
    await expect(page.getByTestId("dock-start-consultation")).toBeVisible();
    await page.goto("/home");
    await expect(page.getByTestId("home-start-consultation")).toHaveCount(0);
    await expect(page.getByTestId("dock-start-consultation")).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId("panel-dock-open")).toHaveCount(0);
    await expect(page.getByTestId("assistant-rail")).toBeVisible();
  });

  test("la marca móvil deja 24 px hasta el logo y la barra inferior omite Seguimiento", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/settings");
    const logo = page.getByTestId("screen-brand").locator('[role="img"]');
    await expect(logo).toBeVisible();
    const box = await logo.boundingBox();
    if (!box) throw new Error("Falta el logo móvil");
    expect(box.y).toBe(24);
    const tabbar = page.getByTestId("app-tabbar");
    await expect(tabbar.getByRole("link", { name: "Seguimiento" })).toHaveCount(0);
    for (const name of ["Inicio", "Pacientes", "Conocimiento", "Configuración"]) {
      await expect(tabbar.getByRole("link", { name, exact: true })).toBeVisible();
    }
  });

  test("todos los destinos móviles muestran su etiqueta en una línea, incluida Configuración", async ({
    page,
  }) => {
    await page.goto("/settings");
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 900 });
      const tabbar = page.getByTestId("app-tabbar");
      for (const name of ["Inicio", "Pacientes", "Conocimiento", "Configuración"]) {
        const label = tabbar.getByText(name, { exact: true });
        await expect(label).toBeVisible();
        const lines = await label.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return range.getClientRects().length;
        });
        expect(lines).toBe(1);
      }
    }
  });

  test("Configuración conserva título y perfil legibles con texto al 200 % en 320 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/settings");
    await expect(page.getByTestId("settings-profile")).toBeVisible();
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    const title = await page
      .getByRole("heading", { name: "Configuración", exact: true })
      .boundingBox();
    if (!title) throw new Error("Falta el título");
    expect(title.x + title.width).toBeLessThanOrEqual(320);
    const name = await page
      .getByTestId("settings-profile")
      .getByText(ANA.displayName, { exact: true })
      .boundingBox();
    if (!name) throw new Error("Falta el nombre del profesional");
    expect(name.width).toBeGreaterThanOrEqual(150);
    await page
      .getByTestId("settings-session")
      .getByTestId("logout-button")
      .scrollIntoViewIfNeeded();
    await expect(
      page.getByTestId("settings-session").getByTestId("logout-button"),
    ).toBeInViewport();
  });

  for (const origin of ["settings-session", "app-sidebar"]) {
    test(`Cerrar sesión indica progreso y bloquea nuevas activaciones desde ${origin}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/settings");
      let release = () => {};
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/rest/v1/rpc/revoke_current_access_session", async (route) => {
        await pending;
        await route.continue();
      });
      const button = page.getByTestId(origin).getByTestId("logout-button");
      try {
        await button.click();
        await expect(button).toBeDisabled();
        await expect(button).toHaveAttribute("aria-busy", "true");
        await expect(button).toHaveText("Cerrando sesión…");
      } finally {
        release();
      }
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("Configuración mantiene las tres tarjetas en una columna en escritorio", async ({
    page,
  }) => {
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/settings");
      const boxes = [];
      for (const id of ["settings-profile", "settings-appearance", "settings-session"]) {
        await expect(page.getByTestId(id)).toBeVisible();
        const box = await page.getByTestId(id).boundingBox();
        if (!box) throw new Error(`Falta la tarjeta ${id}`);
        boxes.push(box);
      }
      const [profile, appearance, session] = boxes;
      if (!profile || !appearance || !session) throw new Error("Faltan tarjetas");
      for (const box of [appearance, session]) {
        expect(Math.abs(box.x - profile.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(box.width - profile.width)).toBeLessThanOrEqual(1);
      }
      expect(appearance.y).toBeGreaterThanOrEqual(profile.y + profile.height + 24);
      expect(session.y).toBeGreaterThanOrEqual(appearance.y + appearance.height + 24);
    }
  });

  test("el botón cambia a oscuro sin recargar, persiste y «Sistema» lo devuelve", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const toggle = page.getByTestId("app-sidebar").getByTestId("theme-toggle");
    await expect(toggle).toHaveAccessibleName("Cambiar a modo oscuro");
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(toggle).toHaveAccessibleName("Cambiar a modo claro");
    await expect.poll(() => background(page)).toBe(DARK_BACKGROUND);

    await page.reload();
    await expect(page.getByTestId("home-agenda")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => background(page)).toBe(DARK_BACKGROUND);
    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
    expect(
      violations.filter((v) => !v.nodes.every((n) => String(n.target).includes("#error-toast"))),
    ).toEqual([]);

    await page.goto("/settings");
    await page.getByTestId("settings-theme").getByRole("radio", { name: "Sistema" }).click();
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
    await expect.poll(() => background(page)).toBe(LIGHT_BACKGROUND);
  });

  test("con la preferencia oscura, el primer pintado ya es oscuro (sin destello)", async ({
    page,
  }) => {
    await page.evaluate(() => localStorage.setItem("diklass.theme", "dark"));
    // Sin el bundle de JS solo actúa el script en línea de `+html.tsx`.
    await page.route("**/*.bundle*", (route) => route.abort());
    await page.goto("/login");
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });

  test("Inicio muestra el mes actual vacío, navegable, sin violaciones en claro y oscuro", async ({
    page,
  }) => {
    const agenda = page.getByTestId("home-agenda");
    await expect(agenda).toBeVisible({ timeout: 15_000 });
    await expect(agenda.getByTestId("calendar-empty")).toHaveText("Sin eventos agendados");
    const title = agenda.getByRole("heading", { level: 3 });
    const before = await title.textContent();
    await agenda.getByRole("button", { name: "Mes siguiente" }).click();
    await expect(title).not.toHaveText(before ?? "");
    await agenda.getByRole("button", { name: "Mes anterior" }).click();
    await expect(title).toHaveText(before ?? "");
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
      expect(
        violations.filter((v) => !v.nodes.every((n) => String(n.target).includes("#error-toast"))),
        scheme,
      ).toEqual([]);
    }
  });

  test("a 1280 px, Configuración queda a 1 activación desde una pantalla protegida", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/patients");
    await expect(page.getByTestId("patients-list")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("app-sidebar").getByRole("link", { name: "Configuración" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId("settings-profile")).toContainText(ANA.displayName);
  });

  // En móvil, Configuración es la última pestaña de la barra inferior y reúne perfil, apariencia
  // y «Cerrar sesión».
  test("a 375 px, la pestaña Configuración muestra perfil, apariencia y cerrar sesión", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/patients");
    await expect(page.getByTestId("patients-list")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("app-tabbar").getByRole("link", { name: "Configuración" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId("settings-profile")).toContainText(ANA.displayName);
    // La barra lateral de escritorio también tiene uno, oculto a este ancho.
    await expect(page.getByTestId("logout-button").filter({ visible: true })).toBeVisible();
    await page.getByTestId("settings-theme").getByRole("radio", { name: "Oscuro" }).click();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await page.getByTestId("settings-edit-profile").click();
    await expect(page).toHaveURL(/\/settings\/profile$/);
  });

  // Revisión de la PR #38 (WCAG 4.1.2): sin acciones por día, los días no son botones ni paradas
  // de Tab; solo se enfocan «Mes anterior» y «Mes siguiente».
  test("en la agenda solo las flechas de mes son controles", async ({ page }) => {
    const agenda = page.getByTestId("home-agenda");
    await expect(agenda).toBeVisible();
    const controles = await agenda.evaluate((el) =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, a[href], [role="button"], [tabindex]:not([tabindex="-1"])',
        ),
      ).map((c) => c.getAttribute("aria-label") ?? c.textContent?.trim() ?? ""),
    );
    expect(new Set(controles)).toEqual(new Set(["Mes anterior", "Mes siguiente"]));
  });
});
