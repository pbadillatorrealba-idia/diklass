import { describe, expect, test } from "bun:test";
import type { EpicrisisContent, PatientContent } from "@/features/registro/schema";
import {
  buildFollowUpSummary,
  buildPatientHistory,
  computeMissingFichaFields,
  type ConsultationHistoryEntry,
  type ClinicalRecordRow,
  effectiveEpicrisis,
} from "@/features/registro/summaries";
import type { Json } from "@/lib/supabase/database.types";

function makeRecord(overrides: {
  id: string;
  content: Json;
  recordType?: string;
  status?: string;
  createdAt?: string;
  supersedesEventId?: string | null;
}): ClinicalRecordRow {
  return {
    approved_at: null,
    approved_by: null,
    clinic_id: "clinica-1",
    content: overrides.content,
    created_at: overrides.createdAt ?? "2026-09-01T10:00:00.000Z",
    created_by: "vet-ana",
    id: overrides.id,
    record_type: overrides.recordType ?? "epicrisis",
    status: overrides.status ?? "draft",
    supersedes_event_id: overrides.supersedesEventId ?? null,
    updated_at: null,
    updated_by: null,
  };
}

function epicrisisDe(consultationId: string, cambios: Partial<EpicrisisContent> = {}) {
  return {
    consultationId,
    motivoConsulta: "Aúlla cuando queda sola.",
    antecedentesRelevantes: "Alergias conocidas: Sin alergias conocidas (hallazgo negativo)",
    hallazgosAnamnesis: "Frecuencia: a diario [procedencia: reportada]",
    hipotesis: [],
    diagnostico: "Ansiedad por separación",
    examenesSolicitados: ["Hemograma"],
    intervencionesPropuestas: ["Modificación de conducta"],
    medicamentosAprobados: [],
    recomendacionesTutor: "Evitar despedidas prolongadas.",
    planSeguimiento: { pendientes: ["Control en 30 días"] },
    observaciones: "",
    ...cambios,
  };
}

function consultaDe(id: string, createdAt: string, status: "open" | "closed" = "closed") {
  return makeRecord({
    id,
    recordType: "consultation",
    content: { patientId: "paciente-1", status },
    createdAt,
  });
}

function entrada(overrides: Partial<ConsultationHistoryEntry> & { consultationId: string }) {
  return {
    openedAt: "2026-09-01T10:00:00.000Z",
    status: "closed" as const,
    epicrisis: null,
    epicrisisSuperseded: false,
    ...overrides,
  };
}

function ficha(cambios: Partial<PatientContent> = {}): PatientContent {
  return {
    name: "Luna",
    species: "perro",
    breed: "Mestizo",
    birthDate: "2021-05-01",
    ageMonths: 24,
    weightKg: 12.4,
    sex: "hembra",
    reproductiveStatus: "esterilizada",
    antecedentes: {
      medicalHistory: [{ text: "Displasia de cadera", negative: false }],
      preexistingDiseases: [{ text: "Displasia de cadera", negative: false }],
      currentMedications: [{ text: "Sin medicación actual", negative: true }],
      knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
      behavioralHistory: [{ text: "Sin antecedentes conductuales", negative: true }],
    },
    tutorId: "tutor-1",
    ...cambios,
  };
}

describe("effectiveEpicrisis (FR-010, FR-024 · US3-AC4)", () => {
  const aprobada = makeRecord({
    id: "e-1",
    content: epicrisisDe("c-1"),
    status: "approved",
    createdAt: "2026-09-01T10:00:00.000Z",
  });
  const correctiva = makeRecord({
    id: "e-2",
    content: epicrisisDe("c-1", { diagnostico: "Fobia a ruidos" }),
    status: "corrective",
    supersedesEventId: "evento-1",
    createdAt: "2026-09-02T10:00:00.000Z",
  });

  test("un borrador nunca es la epicrisis efectiva (FR-010 · US3-AC3)", () => {
    const borrador = makeRecord({ id: "e-9", content: epicrisisDe("c-1"), status: "draft" });

    expect(effectiveEpicrisis([borrador], "c-1")).toBeNull();
  });

  test("la aprobada es efectiva mientras no exista una corrección", () => {
    expect(effectiveEpicrisis([aprobada], "c-1")?.id).toBe("e-1");
    expect(effectiveEpicrisis([], "c-1")).toBeNull();
  });

  test("una corrección supersedea a la aprobada con independencia del orden del arreglo", () => {
    expect(effectiveEpicrisis([aprobada, correctiva], "c-1")?.id).toBe("e-2");
    expect(effectiveEpicrisis([correctiva, aprobada], "c-1")?.id).toBe("e-2");
  });

  test("en la cadena de correcciones prevalece la más reciente (empate resuelto por id)", () => {
    const posterior = makeRecord({
      id: "e-3",
      content: epicrisisDe("c-1", { diagnostico: "Fobia a ruidos corregida" }),
      status: "corrective",
      supersedesEventId: "evento-2",
      createdAt: "2026-09-03T10:00:00.000Z",
    });
    const empatada = makeRecord({
      id: "e-0",
      content: epicrisisDe("c-1", { diagnostico: "Empate" }),
      status: "corrective",
      supersedesEventId: "evento-3",
      createdAt: "2026-09-03T10:00:00.000Z",
    });

    expect(effectiveEpicrisis([aprobada, correctiva, posterior], "c-1")?.id).toBe("e-3");
    expect(effectiveEpicrisis([posterior, empatada], "c-1")?.id).toBe("e-3");
  });

  test("una corrección sin supersedes_event_id no entra en la cadena", () => {
    const huérfana = makeRecord({
      id: "e-4",
      content: epicrisisDe("c-1", { diagnostico: "Huérfana" }),
      status: "corrective",
      createdAt: "2026-09-05T10:00:00.000Z",
    });

    expect(effectiveEpicrisis([aprobada, huérfana], "c-1")?.id).toBe("e-1");
  });

  test("solo cuenta la epicrisis de la consulta pedida", () => {
    const otra = makeRecord({
      id: "e-5",
      content: epicrisisDe("c-2", { diagnostico: "Otra consulta" }),
      status: "approved",
      createdAt: "2026-09-04T10:00:00.000Z",
    });

    expect(effectiveEpicrisis([aprobada, otra, correctiva], "c-2")?.id).toBe("e-5");
  });
});

describe("buildPatientHistory (FR-002, FR-024 · US4-AC4)", () => {
  test("presenta las consultas en orden cronológico ascendente (FR-002 · US4-AC4)", () => {
    const historial = buildPatientHistory({
      consultations: [
        consultaDe("c-2", "2026-09-10T10:00:00.000Z"),
        consultaDe("c-3", "2026-09-20T10:00:00.000Z"),
        consultaDe("c-1", "2026-09-01T10:00:00.000Z"),
      ],
      epicrisis: [],
    });

    expect(historial.map((entry) => entry.consultationId)).toEqual(["c-1", "c-2", "c-3"]);
    expect(historial.map((entry) => entry.openedAt)).toEqual([
      "2026-09-01T10:00:00.000Z",
      "2026-09-10T10:00:00.000Z",
      "2026-09-20T10:00:00.000Z",
    ]);
  });

  test("asocia la epicrisis efectiva y señala la versión superseded (FR-024 · US3-AC4)", () => {
    const aprobada = makeRecord({
      id: "e-1",
      content: epicrisisDe("c-1"),
      status: "approved",
      createdAt: "2026-09-01T11:00:00.000Z",
    });
    const correctiva = makeRecord({
      id: "e-2",
      content: epicrisisDe("c-1", { diagnostico: "Fobia a ruidos" }),
      status: "corrective",
      supersedesEventId: "evento-1",
      createdAt: "2026-09-02T11:00:00.000Z",
    });

    const historial = buildPatientHistory({
      consultations: [consultaDe("c-1", "2026-09-01T10:00:00.000Z")],
      epicrisis: [aprobada, correctiva],
    });

    expect(historial[0]?.epicrisis?.diagnostico).toBe("Fobia a ruidos");
    expect(historial[0]?.epicrisisSuperseded).toBe(true);
    expect(historial[0]?.status).toBe("closed");
  });

  test("sin epicrisis aprobada no hay registro definitivo (FR-010 · US3-AC3)", () => {
    const borrador = makeRecord({
      id: "e-1",
      content: epicrisisDe("c-1"),
      status: "draft",
      createdAt: "2026-09-01T11:00:00.000Z",
    });

    const historial = buildPatientHistory({
      consultations: [consultaDe("c-1", "2026-09-01T10:00:00.000Z", "open")],
      epicrisis: [borrador],
    });

    expect(historial[0]?.epicrisis).toBeNull();
    expect(historial[0]?.epicrisisSuperseded).toBe(false);
    expect(historial[0]?.status).toBe("open");
  });

  test("propaga el error real ante una fila con contenido inválido", () => {
    const corrupta = makeRecord({
      id: "e-1",
      content: { consultationId: "c-1" },
      status: "approved",
      createdAt: "2026-09-01T11:00:00.000Z",
    });

    expect(() =>
      buildPatientHistory({
        consultations: [consultaDe("c-1", "2026-09-01T10:00:00.000Z")],
        epicrisis: [corrupta],
      }),
    ).toThrow();
  });
});

describe("buildFollowUpSummary (FR-013 · US4-AC1/AC3)", () => {
  test("resume diagnóstico, intervenciones, recomendaciones, exámenes y pendientes", () => {
    const resumen = buildFollowUpSummary([
      entrada({ consultationId: "c-1", epicrisis: epicrisisDe("c-1") }),
    ]);

    expect(resumen).toEqual({
      previousDiagnoses: ["Ansiedad por separación"],
      interventions: ["Modificación de conducta"],
      recommendations: ["Evitar despedidas prolongadas."],
      exams: ["Hemograma"],
      pendingItems: ["Control en 30 días"],
    });
  });

  test("señala los pendientes del plan de seguimiento previo (US4-AC3)", () => {
    const resumen = buildFollowUpSummary([
      entrada({
        consultationId: "c-1",
        epicrisis: epicrisisDe("c-1", {
          planSeguimiento: { pendientes: ["Control en 30 días", "Revisar peso"] },
        }),
      }),
    ]);

    expect(resumen.pendingItems).toEqual(["Control en 30 días", "Revisar peso"]);
  });

  test("solo aportan las consultas cerradas con epicrisis efectiva (FR-010, FR-013)", () => {
    const resumen = buildFollowUpSummary([
      entrada({ consultationId: "c-1", status: "open", epicrisis: epicrisisDe("c-1") }),
      entrada({ consultationId: "c-2", epicrisis: null }),
    ]);

    expect(resumen).toEqual({
      previousDiagnoses: [],
      interventions: [],
      recommendations: [],
      exams: [],
      pendingItems: [],
    });
  });

  test("excluye la consulta en curso cuando se indica", () => {
    const resumen = buildFollowUpSummary(
      [
        entrada({ consultationId: "c-1", epicrisis: epicrisisDe("c-1") }),
        entrada({ consultationId: "c-2", epicrisis: epicrisisDe("c-2") }),
      ],
      "c-2",
    );

    expect(resumen.previousDiagnoses).toEqual(["Ansiedad por separación"]);
  });

  test("conserva el orden cronológico y omite diagnósticos y recomendaciones vacíos", () => {
    const resumen = buildFollowUpSummary([
      entrada({
        consultationId: "c-1",
        epicrisis: epicrisisDe("c-1", {
          diagnostico: "Primera",
          recomendacionesTutor: "",
          examenesSolicitados: ["E1"],
          intervencionesPropuestas: ["I1"],
        }),
      }),
      entrada({
        consultationId: "c-2",
        epicrisis: epicrisisDe("c-2", {
          diagnostico: "",
          recomendacionesTutor: "Segunda recomendación",
          examenesSolicitados: ["E2"],
          intervencionesPropuestas: ["I2"],
        }),
      }),
    ]);

    expect(resumen.previousDiagnoses).toEqual(["Primera"]);
    expect(resumen.recommendations).toEqual(["Segunda recomendación"]);
    expect(resumen.exams).toEqual(["E1", "E2"]);
    expect(resumen.interventions).toEqual(["I1", "I2"]);
  });
});

describe("computeMissingFichaFields (FR-044 · US1-AC3)", () => {
  test("una ficha registrada no señala faltantes, ni con hallazgos negativos", () => {
    expect(computeMissingFichaFields(ficha())).toEqual([]);
  });

  test("señala cada campo sin dato y cada grupo sin registrar, en orden estable", () => {
    const faltantes = computeMissingFichaFields(
      ficha({
        birthDate: null,
        ageMonths: null,
        weightKg: null,
        antecedentes: {
          medicalHistory: [],
          preexistingDiseases: [],
          currentMedications: [],
          knownAllergies: [],
          behavioralHistory: [],
        },
      }),
    );

    expect(faltantes).toEqual([
      { field: "birthDate", kind: "sin_dato" },
      { field: "ageMonths", kind: "sin_dato" },
      { field: "weightKg", kind: "sin_dato" },
      { field: "medicalHistory", kind: "sin_registrar_grupo" },
      { field: "preexistingDiseases", kind: "sin_registrar_grupo" },
      { field: "currentMedications", kind: "sin_registrar_grupo" },
      { field: "knownAllergies", kind: "sin_registrar_grupo" },
      { field: "behavioralHistory", kind: "sin_registrar_grupo" },
    ]);
  });

  test("distingue el hallazgo negativo registrado del grupo sin registrar (US1-AC3)", () => {
    const faltantes = computeMissingFichaFields(
      ficha({
        antecedentes: {
          medicalHistory: [],
          preexistingDiseases: [],
          currentMedications: [],
          knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
          behavioralHistory: [{ text: "Sin antecedentes conductuales", negative: true }],
        },
      }),
    );

    expect(faltantes).toEqual([
      { field: "medicalHistory", kind: "sin_registrar_grupo" },
      { field: "preexistingDiseases", kind: "sin_registrar_grupo" },
      { field: "currentMedications", kind: "sin_registrar_grupo" },
    ]);
  });
});
