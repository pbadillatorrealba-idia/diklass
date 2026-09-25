import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  provisionClinicalCase,
  type SyntheticCase,
  type SyntheticScreen,
  syntheticScreens,
} from "./caso-sintetico";
import { ANA, expect, hasBackend, submitLogin, test } from "./fixtures";

const WCAG_22_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_22_AA).analyze();
  // Exclusión documentada del gate: `#error-toast` es el overlay de desarrollo de
  // `@expo/log-box` (`renderInShadowRoot('error-toast', …)`, solo con NODE_ENV=development;
  // no existe en builds de producción). Su marcado —contenedor `.toast` con focables
  // anidados y botón dismiss sin nombre— pertenece al runtime, no a la superficie de la
  // aplicación, y no es editable desde este repo.
  const sobreLaAplicacion = violations
    .map(({ id, help, nodes }) => ({
      id,
      help,
      nodes: nodes
        .filter((node) => !node.target.some((part) => String(part).includes("#error-toast")))
        .map((node) => ({ target: node.target, why: node.failureSummary })),
    }))
    .filter((violation) => violation.nodes.length > 0);
  expect(sobreLaAplicacion).toEqual([]);
}

/**
 * Recorrido mínimo por teclado (D12): se recorre todo control alcanzable por Tab y se
 * afirma que cada uno muestra un indicador de foco visible (WCAG 2.2 AA 2.4.7).
 */
async function walkKeyboard(page: Page, expectedTestIDs: string[]) {
  const reached: string[] = [];
  let firstStop: string | null = null;
  // La navegación global suma ~10 paradas por pantalla (sistema-visual D12/D17).
  for (let step = 0; step < 250; step += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body || element === document.documentElement) {
        return null;
      }
      // Misma exclusión documentada que en `expectNoViolations`: `#error-toast` es el overlay de
      // desarrollo de `@expo/log-box`, que no existe en producción. Firefox lo enfoca cuando la
      // app registra un error en consola (p. ej., filas sintéticas omitidas en una base local).
      if (element.closest("#error-toast")) {
        return { testID: null, identity: "#error-toast", focusVisible: true, devOverlay: true };
      }
      const style = getComputedStyle(element);
      const outlineWidth = Number.parseFloat(style.outlineWidth || "0");
      const outlineVisible =
        style.outlineStyle !== "none" &&
        style.outlineStyle !== "hidden" &&
        outlineWidth > 0 &&
        style.outlineColor !== "transparent" &&
        style.outlineColor !== "rgba(0, 0, 0, 0)";
      const shadowVisible = style.boxShadow !== "none" && style.boxShadow !== "";
      const identity = `${element.tagName}#${element.getAttribute("data-testid") ?? element.getAttribute("aria-label") ?? ""}`;
      return {
        testID: element.getAttribute("data-testid"),
        identity,
        focusVisible: outlineVisible || shadowVisible,
      };
    });
    if (stop === null) {
      break;
    }
    if ("devOverlay" in stop) {
      continue;
    }
    if (firstStop === null) {
      firstStop = stop.identity;
    } else if (stop.identity === firstStop) {
      // Dio la vuelta al conjunto de controles de la pantalla.
      break;
    }
    expect(stop.focusVisible, `Foco sin indicador visible en ${stop.identity}`).toBeTruthy();
    if (stop.testID !== null) {
      reached.push(stop.testID);
    }
  }
  for (const testID of expectedTestIDs) {
    // El mensaje lleva las paradas alcanzadas: el fallo intermitente de sistema-visual 8.2/8.4
    // no se ha podido reproducir a demanda (quickstart.md).
    expect(
      reached,
      `El recorrido por teclado no alcanzó el control ${testID} en ${page.url()} (primera parada ${firstStop}; alcanzó ${reached.join(", ")})`,
    ).toContain(testID);
  }
}

/**
 * Adaptabilidad al viewport (D12; sistema-visual FR-079 · SC-052): sin desbordamiento horizontal
 * desde 320 px (WCAG 1.4.10), en móvil y en escritorio.
 */
async function expectNoHorizontalOverflow(page: Page, screen: SyntheticScreen) {
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(screen.url);
    await expect(page.getByTestId(screen.readyTestID)).toBeVisible({ timeout: 15_000 });
    // El `ScrollView` de RN Web es un contenedor con scroll propio: un desborde dentro de él no
    // agranda el documento. Se mide también cada contenedor que recorta o desplaza en horizontal
    // (salvo campos de texto, cuyo contenido desplazable es esperable).
    const desbordes = await page.evaluate(() => {
      const hallazgos: string[] = [];
      const root = document.documentElement;
      if (root.scrollWidth > root.clientWidth) {
        hallazgos.push(`documento ${root.scrollWidth} > ${root.clientWidth}`);
      }
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) continue;
        const overflowX = getComputedStyle(el).overflowX;
        if (overflowX === "visible" || el.clientWidth === 0) continue;
        if (el.scrollWidth > el.clientWidth + 1) {
          const id = el.getAttribute("data-testid") ?? el.tagName.toLowerCase();
          hallazgos.push(`${id} ${el.scrollWidth} > ${el.clientWidth}`);
        }
      }
      return hallazgos;
    });
    expect(desbordes, `Desbordamiento horizontal a ${width} px en ${screen.name}`).toEqual([]);
  }
}

test.describe("WCAG 2.2 AA gate", () => {
  test("the login screen has no automatically detectable violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    await expectNoViolations(page);
  });

  test("the login error state has no automatically detectable violations", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByTestId("login-error")).toBeVisible();
    await expectNoViolations(page);
  });

  test("the protected screens have no automatically detectable violations", async ({ page }) => {
    test.skip(!hasBackend, "Requires local Supabase with the synthetic veterinarians provisioned.");
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    await expect(page.getByTestId("authenticated-identity")).toBeVisible();
    await expectNoViolations(page);
    // El workspace de consulta y el resto de pantallas del registro clínico se escanean
    // sobre un caso clínico sintético en el bloque de la tarea 5.1 (D12).
  });
});

test.describe("compuerta de accesibilidad del registro clínico (D12 · tarea 5.1)", () => {
  test.skip(!hasBackend, "Requiere Supabase con las veterinarias sintéticas provisionadas.");

  let caso: SyntheticCase = { patientId: "", openConsultationId: "", closedConsultationId: "" };

  test.beforeAll(async ({ browser }) => {
    caso = await provisionClinicalCase(browser);
  });

  test("las pantallas nuevas no tienen violaciones axe (WCAG 2.2 AA)", async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    for (const screen of syntheticScreens(caso)) {
      await page.goto(screen.url);
      await expect(page.getByTestId(screen.readyTestID)).toBeVisible({ timeout: 15_000 });
      await expectNoViolations(page);
    }
  });

  test("recorrido por teclado con foco visible en cada control interactivo", async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    for (const screen of syntheticScreens(caso)) {
      await page.goto(screen.url);
      await expect(page.getByTestId(screen.readyTestID)).toBeVisible({ timeout: 15_000 });
      await walkKeyboard(page, screen.keyboardTestIDs);
    }
  });

  // sistema-visual FR-079 · US13-AC5 (design.md D9): registro y apoyo lado a lado en escritorio,
  // una sola columna en móvil con el contexto de solo lectura antes del registro.
  test("la consulta usa dos columnas a 1280 px y una a 375 px", async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    const cajas = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/consultations/${caso.closedConsultationId}`);
      await expect(page.getByTestId("epicrisis-correction-history")).toBeVisible({
        timeout: 15_000,
      });
      // El resumen de seguimiento llega después: se mide con la red en reposo y ambas cajas a la
      // vez, para no comparar una columna antes y otra después de que crezca.
      await page.waitForLoadState("networkidle");
      return page.evaluate(() => {
        const caja = (id: string) => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          if (!el) throw new Error(`Falta ${id}`);
          const { x, y, width, height } = el.getBoundingClientRect();
          return { x, y, width, height };
        };
        return { principal: caja("consultation-main"), lateral: caja("consultation-aside") };
      });
    };

    const ancho = await cajas(1280);
    expect(ancho.lateral.x, "la columna lateral va a la derecha").toBeGreaterThan(
      ancho.principal.x + ancho.principal.width - 1,
    );
    expect(Math.abs(ancho.lateral.y - ancho.principal.y)).toBeLessThan(2);

    const angosto = await cajas(375);
    expect(angosto.lateral.y + angosto.lateral.height).toBeLessThanOrEqual(angosto.principal.y + 1);
    expect(Math.abs(angosto.lateral.x - angosto.principal.x)).toBeLessThan(2);
  });

  // sistema-visual FR-084 · SC-055 (design.md D13): navegar es un enlace real (`<a href>`), que
  // se puede abrir en otra pestaña y se anuncia como enlace; nunca un botón con `router.push`.
  test("los controles de navegación son enlaces y no botones", async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    const pantallas = [
      { url: "/home", readyTestID: "home-agenda" },
      ...syntheticScreens(caso).map(({ url, readyTestID }) => ({ url, readyTestID })),
    ];
    const encontrados = new Set<string>();
    for (const pantalla of pantallas) {
      await page.goto(pantalla.url);
      await expect(page.getByTestId(pantalla.readyTestID)).toBeVisible({ timeout: 15_000 });
      await page.waitForLoadState("networkidle");
      const controles = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("[data-testid]"))
          .filter((el) =>
            /^(home-(patients|follow-up|knowledge)|patients-register|patient-open|history-open|consultation-patient|follow-up-open|conocimiento-incorporar|ver-fuente-.+|ver-contexto-.+)$/.test(
              el.dataset.testid ?? "",
            ),
          )
          .map((el) => ({
            testID: el.dataset.testid ?? "",
            tag: el.tagName.toLowerCase(),
            href: el.getAttribute("href"),
            role: el.getAttribute("role"),
          })),
      );
      for (const control of controles) {
        const nombre = control.testID.replace(/-[0-9a-f-]{36}.*$/, "-<id>");
        encontrados.add(nombre);
        expect(
          { ...control, pantalla: pantalla.url },
          `${control.testID} en ${pantalla.url} debe ser un enlace`,
        ).toMatchObject({ tag: "a", href: expect.stringMatching(/^\//) });
        expect(control.role, `${control.testID} en ${pantalla.url} tiene rol button`).not.toBe(
          "button",
        );
      }
    }
    // La prueba no vale si las pantallas no pintaron los controles que vigila. `ver-fuente-*`
    // depende de que la base local tenga fuentes, así que no se exige.
    expect([...encontrados]).toEqual(
      expect.arrayContaining([
        "consultation-patient",
        "follow-up-open",
        "history-open",
        "home-follow-up",
        "home-knowledge",
        "home-patients",
        "patient-open",
        "patients-register",
        "conocimiento-incorporar",
      ]),
    );
  });

  test("las pantallas no desbordan horizontalmente a 320, 375 ni 1280 px", async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    for (const screen of syntheticScreens(caso)) {
      await expectNoHorizontalOverflow(page, screen);
    }
  });
});
