import AxeBuilder from "@axe-core/playwright";
import {
  type APIRequestContext,
  request as apiRequest,
  type Browser,
  type Page,
} from "@playwright/test";
import {
  ANA,
  BRUNO,
  expect,
  hasBackend,
  readSupabaseSession,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  submitLogin,
  test,
} from "./fixtures";

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

type SyntheticCase = {
  patientId: string;
  openConsultationId: string;
  closedConsultationId: string;
};

type SyntheticScreen = {
  name: string;
  url: string;
  readyTestID: string;
  keyboardTestIDs: string[];
};

/**
 * Tarea 5.1 (D12): caso clínico sintético (paciente, tutor, dos consultas, anamnesis,
 * epicrisis aprobada y correctiva) provisionado por API siguiendo el patrón de
 * `attribution.spec.ts`. TODAS las escrituras clínicas viajan con el token del veterinario
 * que las hace (ANA o BRUNO), nunca con service role: los triggers de atribución exigen
 * `auth.uid()`.
 */
async function provisionClinicalCase(browser: Browser): Promise<SyntheticCase> {
  const anaContext = await browser.newContext();
  const anaPage = await anaContext.newPage();
  await submitLogin(anaPage, ANA);
  await expect(anaPage).toHaveURL(/\/home$/, { timeout: 15_000 });
  const anaSession = await readSupabaseSession(anaPage);

  const brunoContext = await browser.newContext();
  const brunoPage = await brunoContext.newPage();
  await submitLogin(brunoPage, BRUNO);
  await expect(brunoPage).toHaveURL(/\/home$/, { timeout: 15_000 });
  const brunoSession = await readSupabaseSession(brunoPage);

  const anaApi = await apiRequest.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${anaSession.accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const brunoApi = await apiRequest.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${brunoSession.accessToken}`,
      "Content-Type": "application/json",
    },
  });

  try {
    const clinicResponse = await anaApi.get(
      `/rest/v1/veterinarians?select=clinic_id&id=eq.${anaSession.userId}`,
    );
    const [anaProfile] = (await clinicResponse.json()) as Array<{ clinic_id: string }>;
    if (!anaProfile?.clinic_id) {
      throw new Error("No se pudo leer el clinic_id del perfil de la veterinaria provisionada.");
    }
    const clinicId = anaProfile.clinic_id;

    const insert = async (
      api: APIRequestContext,
      body: {
        recordType: string;
        content: Record<string, unknown>;
        supersedesEventId?: string;
      },
    ): Promise<string> => {
      const response = await api.post("/rest/v1/clinical_records", {
        data: {
          clinic_id: clinicId,
          record_type: body.recordType,
          content: body.content,
          status: body.supersedesEventId ? "corrective" : "draft",
          ...(body.supersedesEventId ? { supersedes_event_id: body.supersedesEventId } : {}),
        },
        headers: { Prefer: "return=representation" },
      });
      expect(response.ok()).toBeTruthy();
      const [row] = (await response.json()) as Array<{ id: string }>;
      if (!row) {
        throw new Error("La inserción del caso sintético no devolvió la fila creada.");
      }
      return row.id;
    };

    const tutorId = await insert(anaApi, {
      recordType: "tutor",
      content: {
        name: "Marcela Rojas (caso sintético)",
        phone: "+56912345678",
        email: "tutora.caso@example.test",
      },
    });
    // La ficha deja campos sin dato (FR-044) y un hallazgo negativo explícito (SC-024):
    // el panel debe distinguirlos visiblemente.
    const patientId = await insert(anaApi, {
      recordType: "patient",
      content: {
        name: "Luna Caso Sintético",
        species: "perro",
        breed: "Mestizo",
        birthDate: null,
        ageMonths: 36,
        weightKg: null,
        sex: "Hembra",
        reproductiveStatus: "Entera",
        antecedentes: {
          medicalHistory: [],
          preexistingDiseases: [{ text: "Sin enfermedades preexistentes", negative: true }],
          currentMedications: [],
          knownAllergies: [],
          behavioralHistory: [],
        },
        tutorId,
      },
    });

    const closedConsultationId = await insert(anaApi, {
      recordType: "consultation",
      content: { patientId, status: "open" },
    });
    const openConsultationId = await insert(anaApi, {
      recordType: "consultation",
      content: { patientId, status: "open" },
    });

    // Primera consulta: anamnesis y diagnóstico de ANA antes de cerrarla con su epicrisis.
    await insert(anaApi, {
      recordType: "anamnesis",
      content: {
        consultationId: closedConsultationId,
        field: "motivo_consulta",
        text: "Aúlla cuando queda sola (caso sintético).",
        provenance: "reportada",
      },
    });
    await insert(anaApi, {
      recordType: "diagnosis",
      content: {
        consultationId: closedConsultationId,
        text: "Ansiedad por separación (caso sintético).",
      },
    });

    // Epicrisis: borrador → aprobada por la RPC (que cierra la consulta en la transacción) →
    // correctiva de BRUNO apuntando al evento epicrisis_approved original (D8). El contenido
    // incluye hipótesis con estado y un pendiente para que el resumen de FR-013 señale algo.
    const epicrisisContent = {
      consultationId: closedConsultationId,
      motivoConsulta: "Aúlla cuando queda sola (caso sintético).",
      antecedentesRelevantes:
        "Enfermedades preexistentes: Sin enfermedades preexistentes (hallazgo negativo).",
      hallazgosAnamnesis: "Motivo de consulta: Aúlla cuando queda sola [procedencia: reportada].",
      hipotesis: [{ texto: "Ansiedad por separación", estado: "confirmada" }],
      diagnostico: "Ansiedad por separación (caso sintético).",
      examenesSolicitados: ["Hemograma completo"],
      intervencionesPropuestas: ["Modificación de conducta"],
      medicamentosAprobados: [],
      recomendacionesTutor: "Evitar despedidas prolongadas.",
      planSeguimiento: { pendientes: ["Control en 30 días (caso sintético)"] },
      observaciones: "",
    };
    const epicrisisDraftId = await insert(anaApi, {
      recordType: "epicrisis",
      content: epicrisisContent,
    });
    const approvalResponse = await anaApi.post("/rest/v1/rpc/approve_clinical_record", {
      data: { p_record_id: epicrisisDraftId },
    });
    expect(approvalResponse.ok()).toBeTruthy();

    const eventsResponse = await anaApi.get(
      `/rest/v1/clinical_audit_events?select=id&entity_id=eq.${epicrisisDraftId}` +
        "&action=eq.epicrisis_approved",
    );
    const [approvalEvent] = (await eventsResponse.json()) as Array<{ id: string }>;
    if (!approvalEvent) {
      throw new Error("No se encontró el evento epicrisis_approved del caso sintético.");
    }
    await insert(brunoApi, {
      recordType: "epicrisis",
      supersedesEventId: approvalEvent.id,
      content: {
        ...epicrisisContent,
        observaciones: "Corrección del caso sintético: se aclara el plan de seguimiento.",
      },
    });

    // Segunda consulta, abierta y retomable: anamnesis de ambas veterinarias (una con
    // corrección de procedencia recuperable) y diagnóstico, para el workspace en curso.
    await insert(anaApi, {
      recordType: "anamnesis",
      content: {
        consultationId: openConsultationId,
        field: "motivo_consulta",
        text: "Control de seguimiento (caso sintético).",
        provenance: "reportada",
      },
    });
    await insert(brunoApi, {
      recordType: "anamnesis",
      content: {
        consultationId: openConsultationId,
        field: "comportamiento_problematico",
        text: "Destruye objetos al quedarse sola (inferido del relato).",
        provenance: "inferida",
        provenanceHistory: [{ provenance: "desconocida" }],
      },
    });
    await insert(anaApi, {
      recordType: "diagnosis",
      content: {
        consultationId: openConsultationId,
        text: "Evolución favorable (caso sintético).",
      },
    });

    return { patientId, openConsultationId, closedConsultationId };
  } finally {
    await anaApi.dispose();
    await brunoApi.dispose();
    await anaContext.close();
    await brunoContext.close();
  }
}

function syntheticScreens(caseIds: SyntheticCase): SyntheticScreen[] {
  return [
    {
      name: "lista de pacientes",
      url: "/patients",
      readyTestID: "patients-list",
      keyboardTestIDs: ["patients-register", "patient-open"],
    },
    {
      name: "alta de ficha con tutor",
      url: "/patients/new",
      readyTestID: "patient-form",
      keyboardTestIDs: [
        "patient-name",
        "patient-species",
        "patient-breed",
        "patient-birth-date",
        "patient-age-months",
        "patient-weight-kg",
        "patient-sex",
        "patient-reproductive-status",
        "tutor-mode-existing",
        "tutor-mode-new",
        "patient-submit",
      ],
    },
    {
      name: "ficha del paciente",
      url: `/patients/${caseIds.patientId}`,
      readyTestID: "missing-fields-panel",
      keyboardTestIDs: [
        "patient-edit",
        "antecedent-add-text",
        "antecedent-finding-reported",
        "antecedent-finding-negative",
        "antecedent-add",
        "history-open",
        "open-consultation",
      ],
    },
    {
      name: "consulta en curso",
      url: `/consultations/${caseIds.openConsultationId}`,
      readyTestID: "anamnesis-section",
      keyboardTestIDs: [
        "consultation-patient",
        "anamnesis-field-motivo-consulta",
        "anamnesis-text",
        "anamnesis-provenance-reportada",
        "anamnesis-submit",
        "anamnesis-provenance-correct-reportada",
        "anamnesis-provenance-correct-inferida",
        "diagnosis-text",
        "diagnosis-submit",
        "epicrisis-generate",
      ],
    },
    {
      name: "consulta cerrada con epicrisis corregida",
      url: `/consultations/${caseIds.closedConsultationId}`,
      readyTestID: "epicrisis-correction-history",
      keyboardTestIDs: ["consultation-patient", "epicrisis-correct"],
    },
    // sistema-visual 5.1: rutas que la compuerta no cubría (quickstart 1.4).
    {
      name: "consulta a la base de conocimiento",
      url: "/knowledge",
      readyTestID: "conocimiento-pregunta",
      keyboardTestIDs: ["conocimiento-pregunta"],
    },
    {
      name: "colección de fuentes",
      url: "/knowledge/sources",
      readyTestID: "conocimiento-incorporar",
      keyboardTestIDs: ["conocimiento-incorporar"],
    },
    {
      name: "incorporar fuente",
      url: "/knowledge/sources/new",
      readyTestID: "fuente-texto",
      keyboardTestIDs: ["fuente-texto"],
    },
    {
      name: "seguimiento: selector de paciente",
      url: "/follow-up",
      readyTestID: "follow-up-patient-list",
      keyboardTestIDs: ["follow-up-open"],
    },
    {
      name: "seguimiento del paciente",
      url: `/follow-up/${caseIds.patientId}`,
      readyTestID: "feedback-antecedents",
      keyboardTestIDs: [],
    },
  ];
}

/**
 * Recorrido mínimo por teclado (D12): se recorre todo control alcanzable por Tab y se
 * afirma que cada uno muestra un indicador de foco visible (WCAG 2.2 AA 2.4.7).
 */
async function walkKeyboard(page: Page, expectedTestIDs: string[]) {
  const reached: string[] = [];
  let firstStop: string | null = null;
  for (let step = 0; step < 150; step += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body || element === document.documentElement) {
        return null;
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
    expect(reached, `El recorrido por teclado no alcanzó el control ${testID}`).toContain(testID);
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

  test("las pantallas no desbordan horizontalmente a 320, 375 ni 1280 px", async ({ page }) => {
    await submitLogin(page, ANA);
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    for (const screen of syntheticScreens(caso)) {
      await expectNoHorizontalOverflow(page, screen);
    }
  });
});
