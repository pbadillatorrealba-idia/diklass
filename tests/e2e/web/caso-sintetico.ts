import { type APIRequestContext, request as apiRequest, type Browser } from "@playwright/test";
import {
  ANA,
  BRUNO,
  expect,
  readSupabaseSession,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  submitLogin,
} from "./fixtures";

export type SyntheticCase = {
  patientId: string;
  openConsultationId: string;
  closedConsultationId: string;
};

export type SyntheticScreen = {
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
export async function provisionClinicalCase(browser: Browser): Promise<SyntheticCase> {
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

    // Retroalimentación sobre la consulta ya cerrada (tarea 7.13 de 005): entrada de BRUNO
    // con un evento adverso grave y su correctiva de ANA, para que el panel de seguimiento
    // muestre antecedentes, cronología con corrección y el reporte con versiones sustituidas.
    const feedbackContent = {
      consultationId: closedConsultationId,
      adherence: "parcial",
      evolution: "mejoriaParcial",
      evolutionNote: null,
      adverseEvents: [{ severity: "grave", description: "Vómito aislado (caso sintético)." }],
      treatmentApplied: "Modificación de conducta",
      treatmentModification: null,
      revisedDiagnosis: null,
    };
    const feedbackId = await insert(brunoApi, {
      recordType: "clinical_feedback",
      content: feedbackContent,
    });
    const feedbackEventResponse = await brunoApi.get(
      "/rest/v1/clinical_audit_events?select=id&entity_type=eq.clinical_feedback" +
        `&entity_id=eq.${feedbackId}&action=eq.clinical_feedback_recorded`,
    );
    const [feedbackEvent] = (await feedbackEventResponse.json()) as Array<{ id: string }>;
    if (!feedbackEvent) {
      throw new Error("No se encontró el evento clinical_feedback_recorded del caso sintético.");
    }
    await insert(anaApi, {
      recordType: "clinical_feedback",
      supersedesEventId: feedbackEvent.id,
      content: { ...feedbackContent, evolutionNote: "Corrección del caso sintético." },
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

export function syntheticScreens(caseIds: SyntheticCase): SyntheticScreen[] {
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
    // Tarea 7.13 de 005 (D11): pantallas de seguimiento entre consultas.
    {
      name: "selector de paciente del seguimiento",
      url: "/follow-up",
      readyTestID: "follow-up-patient-list",
      keyboardTestIDs: ["follow-up-open"],
    },
    {
      name: "panel de seguimiento con entrada corregida",
      url: `/follow-up/${caseIds.patientId}`,
      readyTestID: "adverse-event-toggle-superseded",
      keyboardTestIDs: [
        "feedback-correct",
        "adverse-event-toggle-superseded",
        `feedback-consultation-picker-${caseIds.closedConsultationId}`,
        "feedback-adherence-completa",
        "feedback-evolution-mejoria",
        "feedback-treatment-applied",
        "feedback-treatment-modification",
        "feedback-revised-diagnosis",
        "feedback-evolution-note",
        "feedback-adverse-add",
      ],
    },
  ];
}
