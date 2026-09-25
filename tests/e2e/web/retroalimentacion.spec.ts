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

type Preparado = {
  api: APIRequestContext;
  clinicId: string;
  patientId: string;
  consultationId: string;
};

/**
 * Inicia sesión como Ana y crea por la Data API un paciente con una consulta cerrada (aprobar
 * la epicrisis la cierra, D4 de 002). Los datos de partida no son el objeto de estas pruebas,
 * así que no se cargan por la interfaz (patrón de `registro-epicrisis.spec.ts`).
 */
async function prepararConsultaCerrada(page: Page, nombre: string): Promise<Preparado> {
  await submitLogin(page, ANA);
  await expect(page).toHaveURL(/\/home$/, { timeout: 10_000 });
  const session = await readSupabaseSession(page);

  const api = await apiRequest.newContext({
    baseURL: SUPABASE_URL,
    extraHTTPHeaders: {
      apikey: SUPABASE_ANON_KEY as string,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });

  const perfil = await api.get(`/rest/v1/veterinarians?select=clinic_id&id=eq.${session.userId}`);
  const [anaPerfil] = (await perfil.json()) as Array<{ clinic_id: string }>;
  if (!anaPerfil) {
    throw new Error("Could not read Ana's clinic_id from her veterinarian profile.");
  }
  const clinicId = anaPerfil.clinic_id;

  const crear = async (recordType: string, content: Record<string, unknown>) => {
    const respuesta = await api.post("/rest/v1/clinical_records", {
      data: { clinic_id: clinicId, record_type: recordType, content, status: "draft" },
    });
    expect(respuesta.status()).toBe(201);
    const [fila] = (await respuesta.json()) as Array<{ id: string }>;
    if (!fila) {
      throw new Error(`The ${recordType} insert returned no row.`);
    }
    return fila.id;
  };

  const patientId = await crear("patient", {
    name: nombre,
    species: "canino",
    breed: "Mestizo",
    birthDate: "2021-03-10",
    ageMonths: null,
    weightKg: 12.5,
    sex: "hembra",
    reproductiveStatus: "entera",
    antecedentes: {
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [],
      behavioralHistory: [],
    },
    tutorId: crypto.randomUUID(),
  });
  const consultationId = await crear("consultation", { patientId, status: "open" });
  const epicrisisId = await crear("epicrisis", {
    consultationId,
    motivoConsulta: "Ansiedad por separación",
    diagnostico: "Ansiedad por separación",
    medicamentosAprobados: ["Fluoxetina 20 mg cada 24 h"],
    intervencionesPropuestas: ["Manejo ambiental"],
    planSeguimiento: { pendientes: ["Control en 4 semanas"] },
  });
  const aprobacion = await api.post("/rest/v1/rpc/approve_clinical_record", {
    data: { p_record_id: epicrisisId },
  });
  expect(aprobacion.ok()).toBeTruthy();

  return { api, clinicId, patientId, consultationId };
}

const contenidoBase = (consultationId: string) => ({
  consultationId,
  adherence: "parcial",
  evolution: "mejoriaParcial",
  evolutionNote: null,
  adverseEvents: [{ severity: "grave", description: "Convulsión aislada" }],
  treatmentApplied: "Fluoxetina 20 mg cada 24 h",
  treatmentModification: null,
  revisedDiagnosis: null,
});

/** Registra una entrada original y `correcciones` correctivas encadenadas a su evento (D7). */
async function registrarConCorrecciones(preparado: Preparado, correcciones: number): Promise<void> {
  const { api, clinicId, consultationId } = preparado;
  const original = await api.post("/rest/v1/clinical_records", {
    data: {
      clinic_id: clinicId,
      record_type: "clinical_feedback",
      content: contenidoBase(consultationId),
      status: "draft",
    },
  });
  expect(original.status()).toBe(201);
  const [fila] = (await original.json()) as Array<{ id: string }>;
  const evento = await api.get(
    `/rest/v1/clinical_audit_events?select=id&entity_type=eq.clinical_feedback&entity_id=eq.${fila?.id}&action=eq.clinical_feedback_recorded`,
  );
  const [registro] = (await evento.json()) as Array<{ id: string }>;
  for (let indice = 0; indice < correcciones; indice += 1) {
    const correctiva = await api.post("/rest/v1/clinical_records", {
      data: {
        clinic_id: clinicId,
        record_type: "clinical_feedback",
        content: { ...contenidoBase(consultationId), evolutionNote: `Corrección ${indice + 1}` },
        status: "corrective",
        supersedes_event_id: registro?.id,
      },
    });
    expect(correctiva.status()).toBe(201);
  }
}

test.describe("retroalimentación clínica web", () => {
  test.beforeEach(() => {
    test.skip(
      !SUPABASE_URL || !SUPABASE_ANON_KEY,
      "Requires a local Supabase instance with vet.ana@example.test provisioned.",
    );
  });

  // Revisión de la PR #28 (hallazgo 3): cada corrección copia los eventos del original, así
  // que un único evento grave aparecía resaltado una vez por versión de la cadena.
  test("el reporte de eventos adversos muestra una vez el evento de una entrada corregida dos veces", async ({
    page,
  }) => {
    const preparado = await prepararConsultaCerrada(page, "Luna E2E eventos adversos");
    try {
      await registrarConCorrecciones(preparado, 2);

      await page.goto(`/follow-up/${preparado.patientId}`);
      const reporte = page.getByTestId("adverse-event-report").filter({ visible: true });
      await expect(reporte.getByTestId("adverse-event-item")).toHaveCount(1);
      await expect(reporte.getByTestId("adverse-event-item")).toContainText("Convulsión aislada");

      // Las versiones sustituidas siguen recuperables, a demanda y sin el resalte de grave.
      await expect(reporte.getByTestId("adverse-event-superseded-item")).toHaveCount(0);
      await reporte
        .getByRole("button", { name: "Mostrar los eventos de versiones ya corregidas" })
        .click();
      await expect(reporte.getByTestId("adverse-event-superseded-item")).toHaveCount(2);
    } finally {
      await preparado.api.dispose();
    }
  });

  // Revisión de la PR #28 (hallazgo 4): «Corregir» sobre una versión ya sustituida
  // prellenaba el contenido viejo y revertía en silencio la corrección vigente.
  test("solo la versión vigente de una cadena ofrece «Corregir entrada»", async ({ page }) => {
    const preparado = await prepararConsultaCerrada(page, "Nube E2E corregir vigente");
    try {
      await registrarConCorrecciones(preparado, 1);

      await page.goto(`/follow-up/${preparado.patientId}`);
      const cronologia = page.getByTestId("feedback-timeline").filter({ visible: true });
      await expect(cronologia.getByTestId("feedback-timeline-item")).toHaveCount(2);
      await expect(cronologia.getByTestId("feedback-correct")).toHaveCount(1);
      const vigente = cronologia
        .getByTestId("feedback-timeline-item")
        .filter({ has: page.getByTestId("feedback-effective-mark") });
      await expect(vigente.getByTestId("feedback-correct")).toHaveCount(1);
    } finally {
      await preparado.api.dispose();
    }
  });

  // Revisión de la PR #28 (hallazgo 5): `isBusy` solo deshabilita el botón tras el render;
  // dos pulsaciones rápidas registraban dos entradas inmutables e inborrables (D4).
  test("dos pulsaciones rápidas en «Registrar evolución» registran una sola entrada", async ({
    page,
  }) => {
    const preparado = await prepararConsultaCerrada(page, "Sol E2E doble envío");
    try {
      await page.goto(`/follow-up/${preparado.patientId}`);
      await page
        .getByRole("radio", { name: /Consulta del/ })
        .filter({ visible: true })
        .first()
        .click();
      // Las dos pulsaciones llegan en la misma tarea, antes de que React vuelva a renderizar
      // (como un doble toque en el dispositivo): un clic por Playwright deja pasar el render.
      await page
        .getByTestId("feedback-submit")
        .filter({ visible: true })
        .evaluate((boton: HTMLElement) => {
          boton.click();
          boton.click();
        });
      await expect(page.getByTestId("feedback-status").filter({ visible: true })).toHaveText(
        "Retroalimentación registrada.",
      );
      // Margen para que una segunda escritura en vuelo llegue al servidor antes de contar.
      await page.waitForTimeout(1_000);

      const filas = await preparado.api.get(
        `/rest/v1/clinical_records?select=id&record_type=eq.clinical_feedback&content->>consultationId=eq.${preparado.consultationId}`,
      );
      expect(await filas.json()).toHaveLength(1);
    } finally {
      await preparado.api.dispose();
    }
  });

  // Revisión de la PR #28 (hallazgo 6): los antecedentes mostraban los identificadores del
  // vocabulario (`mejoriaParcial`) y un texto vacío que no correspondía a lo que se lista.
  test("los antecedentes muestran el vocabulario en español", async ({ page }) => {
    const preparado = await prepararConsultaCerrada(page, "Kira E2E antecedentes");
    try {
      await page.goto(`/follow-up/${preparado.patientId}`);
      const antecedentes = page.getByTestId("feedback-antecedents").filter({ visible: true });
      await expect(antecedentes.getByTestId("feedback-antecedents-empty")).toHaveText(
        "Sin evolución registrada para este paciente.",
      );

      await registrarConCorrecciones(preparado, 0);
      await page.reload();
      const item = page.getByTestId("feedback-antecedent-item").filter({ visible: true });
      await expect(item).toContainText("adherencia Parcial, evolución Mejoría parcial");
      await expect(item).not.toContainText("mejoriaParcial");
    } finally {
      await preparado.api.dispose();
    }
  });

  // Revisión de la PR #28 (hallazgo 7): un error de autenticación en las lecturas del panel
  // solo mostraba «No pudimos cargar…», sin marcar la sesión como expirada.
  test("una lectura rechazada por sesión expirada abre el diálogo de sesión expirada", async ({
    page,
  }) => {
    const preparado = await prepararConsultaCerrada(page, "Toby E2E sesión");
    try {
      await page.route("**/rest/v1/clinical_records?*", async (route) => {
        if (
          route.request().method() === "GET" &&
          route.request().url().includes("record_type=eq.clinical_feedback")
        ) {
          await route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ code: "PGRST303", message: "JWT expired" }),
          });
          return;
        }
        await route.fallback();
      });

      await page.goto(`/follow-up/${preparado.patientId}`);
      await expect(page.getByText("Sesión expirada")).toBeVisible();
      await expect(page.getByTestId("feedback-load-error")).toHaveCount(0);
    } finally {
      await preparado.api.dispose();
    }
  });
});
