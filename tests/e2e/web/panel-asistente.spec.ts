import type { Page } from "@playwright/test";
import { provisionClinicalCase, type SyntheticCase } from "./caso-sintetico";
import { ANA, expect, hasBackend, submitLogin, test } from "./fixtures";
import { abrirHilo, limpiarConversacion } from "./panel";

// sistema-visual «Shell de tres zonas» y «Panel de asistente colapsable»
// (shell-asistente-tres-zonas, design.md D1/D2/D8/D10).
test.describe("shell de tres zonas con panel de asistente", () => {
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");

  let caso: SyntheticCase = { patientId: "", openConsultationId: "", closedConsultationId: "" };

  test.beforeAll(async ({ browser }) => {
    caso = await provisionClinicalCase(browser);
  });

  test.beforeEach(async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    await limpiarConversacion(page);
  });

  const box = async (page: Page, testID: string) => {
    const found = await page.getByTestId(testID).boundingBox();
    if (!found) throw new Error(`Falta ${testID}`);
    return found;
  };

  const openPatients = async (page: Page, width: number) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/patients");
    await expect(page.getByTestId("patients-list")).toBeVisible({ timeout: 15_000 });
  };

  test("a 1440 px se ven barra lateral, contenido y panel lado a lado", async ({ page }) => {
    await openPatients(page, 1440);
    const sidebar = await box(page, "app-sidebar");
    const panel = await box(page, "assistant-panel");
    const main = await page.getByRole("main").boundingBox();
    if (!main) throw new Error("Falta el contenido");

    expect(sidebar.x + sidebar.width).toBeLessThanOrEqual(main.x + 1);
    expect(main.x + main.width).toBeLessThanOrEqual(panel.x + 1);
    expect(panel.width).toBe(360);
    await expect(page.getByRole("complementary", { name: "Asistente" })).toBeVisible();
    await expect(page.getByTestId("assistant-toggle")).toHaveAttribute("aria-expanded", "true");
    // El panel es un hermano del contenido, no una parte de él (D1).
    await expect(page.getByRole("main").getByTestId("assistant-panel")).toHaveCount(0);
  });

  test("el panel sigue a la barra lateral y al contenido en el orden del DOM", async ({ page }) => {
    await openPatients(page, 1440);
    const orden = await page.evaluate(() => {
      const posicion = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) throw new Error(`Falta ${selector}`);
        return el;
      };
      const sidebar = posicion('[data-testid="app-sidebar"]');
      const main = posicion('[role="main"]');
      const panel = posicion('[data-testid="assistant-panel"]');
      const despues = (a: Element, b: Element) =>
        Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { sidebarMain: despues(sidebar, main), mainPanel: despues(main, panel) };
    });
    expect(orden).toEqual({ sidebarMain: true, mainPanel: true });
  });

  test("colapsa a riel de 56 px, y sigue colapsado tras recargar", async ({ page }) => {
    await openPatients(page, 1440);
    await page.getByTestId("assistant-toggle").click();
    await expect(page.getByTestId("assistant-rail")).toBeVisible();
    expect((await box(page, "assistant-panel")).width).toBe(56);

    await page.reload();
    await expect(page.getByTestId("patients-list")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("assistant-rail")).toBeVisible();
    expect((await box(page, "assistant-panel")).width).toBe(56);
    await expect(page.getByTestId("assistant-toggle")).toHaveAttribute("aria-expanded", "false");

    // Se deja el dispositivo como estaba: el estado persiste entre pruebas del mismo contexto.
    await page.getByTestId("assistant-toggle").click();
    await expect(page.getByTestId("assistant-toggle")).toHaveAttribute("aria-expanded", "true");
  });

  test("a 1280 px el riel está visible y el panel abre como cajón sin mover el contenido", async ({
    page,
  }) => {
    await openPatients(page, 1280);
    expect((await box(page, "assistant-panel")).width).toBe(56);
    await expect(page.getByTestId("assistant-drawer")).toHaveCount(0);

    const antes = await page.getByRole("main").boundingBox();
    const toggle = page.getByTestId("assistant-toggle");
    await toggle.click();
    await expect(page.getByTestId("assistant-drawer")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    const despues = await page.getByRole("main").boundingBox();
    expect(despues).toEqual(antes);

    // Escape lo cierra y el foco vuelve al control del riel.
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("assistant-drawer")).toHaveCount(0);
    await expect(toggle).toBeFocused();
  });

  test("el cajón también se cierra con su control y con el scrim", async ({ page }) => {
    await openPatients(page, 1280);
    await page.getByTestId("assistant-toggle").click();
    await page.getByTestId("assistant-drawer-close").click();
    await expect(page.getByTestId("assistant-drawer")).toHaveCount(0);

    await page.getByTestId("assistant-toggle").click();
    await page.getByTestId("assistant-scrim").click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId("assistant-drawer")).toHaveCount(0);
  });

  test("a 375 px no hay panel acoplado ni riel", async ({ page }) => {
    await openPatients(page, 375);
    await expect(page.getByTestId("assistant-panel")).toHaveCount(0);
    await expect(page.getByTestId("assistant-rail")).toHaveCount(0);
  });

  test("«Ir al asistente» lleva el foco al panel", async ({ page }) => {
    await openPatients(page, 1440);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const atajo = page.getByRole("link", { name: "Ir al asistente" });
    await expect(atajo).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("assistant-panel")).toBeFocused();
  });

  test("la consulta sigue a una columna a 1440 px y el panel queda fuera de su contenido", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/consultations/${caso.closedConsultationId}`);
    await expect(page.getByTestId("epicrisis-correction-history")).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState("networkidle");

    const principal = await box(page, "consultation-main");
    const lateral = await box(page, "consultation-aside");
    expect(lateral.y + lateral.height).toBeLessThanOrEqual(principal.y + 1);
    expect(Math.abs(lateral.x - principal.x)).toBeLessThan(2);
    await expect(page.getByTestId("assistant-panel")).toBeVisible();
    await expect(page.getByRole("main").getByTestId("assistant-panel")).toHaveCount(0);
  });
  test("el hilo «Asistente» responde la fecha y dice que no hay eventos agendados", async ({
    page,
  }) => {
    await openPatients(page, 1440);
    await abrirHilo(page, "asistente");
    const panel = page.getByTestId("assistant-panel");
    await panel.getByTestId("composer-input").fill("¿Qué día es hoy?");
    await panel.getByTestId("composer-send").click();
    await expect(panel.getByTestId("message-assistant").first()).toContainText(
      /Hoy es .+ de \d{4}\./,
    );
    await panel.getByTestId("composer-input").fill("¿Qué eventos tengo agendados?");
    await panel.getByTestId("composer-send").click();
    await expect(panel.getByTestId("message-assistant").nth(1)).toContainText(
      "No tienes eventos agendados",
    );
    await expect(panel.getByTestId("agent-proposal")).toHaveCount(0);
  });

  test("los pacientes de hoy son los de las consultas de hoy", async ({ page }) => {
    await openPatients(page, 1440);
    await abrirHilo(page, "asistente");
    const panel = page.getByTestId("assistant-panel");
    await panel.getByTestId("composer-input").fill("¿Cuáles son los pacientes de hoy?");
    await panel.getByTestId("composer-send").click();
    await expect(panel.getByTestId("message-assistant").last()).toContainText(
      /Pacientes con consulta hoy:|No hay pacientes con consulta registrada hoy\./,
      { timeout: 15_000 },
    );
  });

  test("el inicio solo ofrece «Asistente», sin pestañas ni «Conocimiento»", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/home");
    const panel = page.getByTestId("assistant-panel");
    await expect(panel.getByTestId("composer-input")).toBeVisible({ timeout: 15_000 });
    await expect(panel.getByTestId("assistant-thread-asistente")).toHaveCount(0);
    await expect(panel.getByTestId("assistant-thread-conocimiento")).toHaveCount(0);
  });

  test("el borde del panel se arrastra con el mouse y el contenido cede el ancho", async ({
    page,
  }) => {
    await openPatients(page, 1440);
    const asa = await box(page, "assistant-resize");
    const antes = await box(page, "assistant-panel");
    expect(antes.width).toBe(360);
    const y = asa.y + asa.height / 2;
    await page.mouse.move(asa.x + asa.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(asa.x + asa.width / 2 - 100, y, { steps: 5 });
    await page.mouse.up();
    expect((await box(page, "assistant-panel")).width).toBe(460);
    // Los límites se respetan.
    const asa2 = await box(page, "assistant-resize");
    await page.mouse.move(asa2.x + asa2.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(0, y, { steps: 5 });
    await page.mouse.up();
    expect((await box(page, "assistant-panel")).width).toBe(560);
    // El ancho se recuerda al recargar.
    await page.reload();
    await expect(page.getByTestId("assistant-panel")).toBeVisible({ timeout: 15_000 });
    expect((await box(page, "assistant-panel")).width).toBe(560);
  });

  test("el borde del panel también se mueve con las flechas", async ({ page }) => {
    await openPatients(page, 1440);
    await page.getByTestId("assistant-resize").focus();
    await page.keyboard.press("ArrowLeft");
    expect((await box(page, "assistant-panel")).width).toBe(376);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect((await box(page, "assistant-panel")).width).toBe(344);
  });

  // sistema-visual «Dock de asistente en compacto» y «Hoja del asistente en compacto» (design.md D7).
  test("a 375 px la cinta está al pie con controles de al menos 44×44 y nombra el hilo activo", async ({
    page,
  }) => {
    await openPatients(page, 375);
    const cinta = page.getByTestId("panel-dock");
    await expect(cinta).toBeVisible();
    await expect(cinta).toBeInViewport();
    const abrir = page.getByTestId("panel-dock-open");
    await expect(abrir).toHaveAccessibleName(/^Abrir el asistente: /);
    const caja = await abrir.boundingBox();
    expect(caja?.height).toBeGreaterThanOrEqual(44);
    expect(caja?.width).toBeGreaterThanOrEqual(44);
    // Sobre la barra de pestañas: la cinta termina donde empieza la barra inferior.
    const barra = await box(page, "app-tabbar");
    const cajaCinta = await box(page, "panel-dock");
    expect(cajaCinta.y + cajaCinta.height).toBeLessThanOrEqual(barra.y + 1);
  });

  test("la hoja se abre desde la cinta, atrapa el foco y se cierra con Escape devolviéndolo", async ({
    page,
  }) => {
    await openPatients(page, 375);
    const abrir = page.getByTestId("panel-dock-open");
    await abrir.click();
    const hoja = page.getByRole("dialog", { name: "Asistente" });
    await expect(hoja).toBeVisible();
    const dentro = () =>
      page.evaluate(() =>
        Boolean(
          document.querySelector('[data-testid="panel-sheet"]')?.contains(document.activeElement),
        ),
      );
    await expect.poll(dentro).toBe(true);
    // El foco queda atrapado: ni muchas pulsaciones de Tab lo sacan de la hoja.
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      expect(await dentro()).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("panel-sheet")).toHaveCount(0);
    await expect(abrir).toBeFocused();
  });

  test("la hoja se cierra con su control visible y devuelve el foco a la cinta", async ({
    page,
  }) => {
    await openPatients(page, 375);
    await page.getByTestId("panel-dock-open").click();
    const cerrar = page.getByTestId("panel-sheet-close");
    await expect(cerrar).toBeVisible();
    expect((await cerrar.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await cerrar.click();
    await expect(page.getByTestId("panel-sheet")).toHaveCount(0);
    await expect(page.getByTestId("panel-dock-open")).toBeFocused();
  });

  test("la hoja aloja el chat y no ofrece un hilo «Conocimiento»", async ({ page }) => {
    await openPatients(page, 375);
    await page.getByTestId("panel-dock-open").click();
    const hoja = page.getByTestId("panel-sheet");
    // En una pantalla sin consulta el único hilo es el chat: se nombra sin pestañas.
    await expect(hoja.getByTestId("composer-input")).toBeVisible();
    await expect(hoja.getByTestId("assistant-thread-conocimiento")).toHaveCount(0);
  });
});
