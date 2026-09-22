import { describe, expect, test } from "bun:test";
import {
  aggregateFeedback,
  buildFeedbackAntecedents,
  buildFeedbackTimeline,
  collectAdverseEvents,
  type FeedbackEntry,
} from "@/features/retroalimentacion/feedback-summary";
import type { FeedbackContent } from "@/features/retroalimentacion/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";

function fila(overrides: Partial<ClinicalRecordRow> = {}): ClinicalRecordRow {
  return {
    id: "fb-1",
    clinic_id: "clinica-1",
    record_type: "clinical_feedback",
    content: {},
    status: "draft",
    supersedes_event_id: null,
    created_by: "vet-ana",
    created_at: "2026-09-22T09:00:00.000Z",
    updated_by: null,
    updated_at: null,
    approved_at: null,
    approved_by: null,
    ...overrides,
  };
}

function entrada(
  id: string,
  contenido: Partial<FeedbackContent> & { consultationId: string },
  opciones: {
    createdAt?: string;
    correctsRecordId?: string | null;
    status?: "draft" | "approved" | "corrective";
  } = {},
): FeedbackEntry {
  return {
    record: fila({
      id,
      created_at: opciones.createdAt ?? "2026-09-22T09:00:00.000Z",
      status: opciones.status ?? "draft",
    }),
    content: {
      adherence: "completa",
      evolution: "mejoria",
      evolutionNote: null,
      adverseEvents: [],
      treatmentApplied: null,
      treatmentModification: null,
      revisedDiagnosis: null,
      ...contenido,
    } as FeedbackContent,
    correctsRecordId: opciones.correctsRecordId ?? null,
  };
}

describe("buildFeedbackTimeline — cronología sin sobrescritura (FR-056 · US10-AC11)", () => {
  test("conserva todas las entradas en orden cronológico, con el id como desempate", () => {
    const timeline = buildFeedbackTimeline([
      entrada("fb-3", { consultationId: "c-1" }, { createdAt: "2026-09-22T09:00:00.000Z" }),
      entrada("fb-1", { consultationId: "c-1" }, { createdAt: "2026-09-01T09:00:00.000Z" }),
      entrada("fb-2", { consultationId: "c-1" }, { createdAt: "2026-09-08T09:00:00.000Z" }),
    ]);

    expect(timeline.map((item) => item.record.id)).toEqual(["fb-1", "fb-2", "fb-3"]);
  });

  test("empates de fecha se resuelven por id sin perder ninguna entrada", () => {
    const timeline = buildFeedbackTimeline([
      entrada("fb-b", { consultationId: "c-1" }, { createdAt: "2026-09-22T09:00:00.000Z" }),
      entrada("fb-a", { consultationId: "c-1" }, { createdAt: "2026-09-22T09:00:00.000Z" }),
    ]);

    expect(timeline.map((item) => item.record.id)).toEqual(["fb-a", "fb-b"]);
    expect(timeline.every((item) => item.effective)).toBe(true);
  });

  test("filtra por consulta cuando se pide", () => {
    const timeline = buildFeedbackTimeline(
      [
        entrada("fb-1", { consultationId: "c-1" }),
        entrada("fb-2", { consultationId: "c-2" }),
      ],
      "c-1",
    );

    expect(timeline.map((item) => item.record.id)).toEqual(["fb-1"]);
  });
});

describe("buildFeedbackTimeline — corrección como registro nuevo (FR-024 · US10-AC5 · D7)", () => {
  test("el original permanece, queda marcado como sustituido y la vigente es la correctiva más reciente", () => {
    const timeline = buildFeedbackTimeline([
      entrada(
        "fb-original",
        { consultationId: "c-1", adherence: "parcial" },
        { createdAt: "2026-09-01T09:00:00.000Z" },
      ),
      entrada(
        "fb-corr-2",
        { consultationId: "c-1", adherence: "completa" },
        {
          createdAt: "2026-09-22T09:00:00.000Z",
          correctsRecordId: "fb-original",
          status: "corrective",
        },
      ),
      entrada(
        "fb-corr-1",
        { consultationId: "c-1", adherence: "ninguna" },
        {
          createdAt: "2026-09-15T09:00:00.000Z",
          correctsRecordId: "fb-original",
          status: "corrective",
        },
      ),
    ]);

    expect(
      timeline.map((item) => [item.record.id, item.effective, item.supersededByRecordId]),
    ).toEqual([
      ["fb-original", false, "fb-corr-1"],
      ["fb-corr-1", false, "fb-corr-2"],
      ["fb-corr-2", true, null],
    ]);
  });

  test("las correctivas sucesivas resuelven todas al mismo original (D7)", () => {
    const timeline = buildFeedbackTimeline([
      entrada("fb-original", { consultationId: "c-1" }, { createdAt: "2026-09-01T09:00:00.000Z" }),
      entrada(
        "fb-corr-1",
        { consultationId: "c-1" },
        { createdAt: "2026-09-15T09:00:00.000Z", correctsRecordId: "fb-original", status: "corrective" },
      ),
      entrada(
        "fb-corr-2",
        { consultationId: "c-1" },
        { createdAt: "2026-09-22T09:00:00.000Z", correctsRecordId: "fb-original", status: "corrective" },
      ),
    ]);

    expect(timeline.map((item) => item.correctsRecordId)).toEqual([
      null,
      "fb-original",
      "fb-original",
    ]);
  });
});

describe("collectAdverseEvents — diferenciados del resto de la evolución (FR-041 · SC-035 · US10-AC2)", () => {
  test("recupera el 100% de los eventos adversos registrados, con su contexto y severidad", () => {
    const timeline = buildFeedbackTimeline([
      entrada(
        "fb-original",
        { consultationId: "c-1", evolutionNote: "Mejora parcial", adverseEvents: [{ severity: "grave", description: "Convulsiones" }] },
        { createdAt: "2026-09-01T09:00:00.000Z" },
      ),
      entrada(
        "fb-corr",
        { consultationId: "c-1", evolutionNote: "Sin eventos", adverseEvents: [] },
        { createdAt: "2026-09-15T09:00:00.000Z", correctsRecordId: "fb-original", status: "corrective" },
      ),
      entrada(
        "fb-2",
        { consultationId: "c-2", adverseEvents: [{ severity: "leve", description: "Somnolencia leve" }] },
        { createdAt: "2026-09-22T09:00:00.000Z" },
      ),
    ]);

    const eventos = collectAdverseEvents(timeline);

    expect(eventos.map((item) => item.event.description)).toEqual([
      "Convulsiones",
      "Somnolencia leve",
    ]);
    expect(eventos[0]?.feedbackRecordId).toBe("fb-original");
    expect(eventos[0]?.consultationId).toBe("c-1");
    expect(eventos[0]?.registeredAt).toBe("2026-09-01T09:00:00.000Z");
    expect(eventos[0]?.effective).toBe(false);
    expect(eventos[0]?.event.severity).toBe("grave");
    expect(eventos[1]?.effective).toBe(true);
    expect(eventos[1]?.event.severity).toBe("leve");
  });
});

describe("aggregateFeedback — categóricos agregados sin texto libre (FR-043 · SC-023 · US10-AC9)", () => {
  test("recupera adherencia y evolución por categoría y eventos adversos por severidad", () => {
    const timeline = buildFeedbackTimeline([
      entrada("fb-1", {
        consultationId: "c-1",
        adherence: "parcial",
        evolution: "mejoriaParcial",
        adverseEvents: [{ severity: "leve", description: "Somnolencia" }],
      }),
      entrada(
        "fb-2",
        {
          consultationId: "c-2",
          adherence: "desconocida",
          evolution: "desconocida",
          adverseEvents: [{ severity: "grave", description: "Convulsiones" }],
        },
        { createdAt: "2026-09-23T09:00:00.000Z" },
      ),
    ]);

    const agregados = aggregateFeedback(timeline);

    expect(agregados.total).toBe(2);
    expect(agregados.adherence).toEqual({
      completa: 0,
      parcial: 1,
      ninguna: 0,
      desconocida: 1,
    });
    expect(agregados.evolution).toEqual({
      mejoria: 0,
      mejoriaParcial: 1,
      sinCambios: 0,
      empeoramiento: 0,
      desconocida: 1,
    });
    expect(agregados.adverseEvents).toEqual({ leve: 1, moderado: 0, grave: 1 });
  });

  test("las versiones sustituidas no se agregan: la corrección reemplaza sin perder el original", () => {
    const timeline = buildFeedbackTimeline([
      entrada(
        "fb-original",
        { consultationId: "c-1", adherence: "parcial", evolution: "sinCambios" },
        { createdAt: "2026-09-01T09:00:00.000Z" },
      ),
      entrada(
        "fb-corr",
        {
          consultationId: "c-1",
          adherence: "completa",
          evolution: "mejoria",
          adverseEvents: [{ severity: "leve", description: "Somnolencia" }],
        },
        { createdAt: "2026-09-15T09:00:00.000Z", correctsRecordId: "fb-original", status: "corrective" },
      ),
    ]);

    const agregados = aggregateFeedback(timeline);

    expect(agregados.total).toBe(1);
    expect(agregados.adherence.parcial).toBe(0);
    expect(agregados.adherence.completa).toBe(1);
    expect(agregados.evolution.mejoria).toBe(1);
    expect(agregados.adverseEvents.leve).toBe(1);
  });
});

describe("buildFeedbackAntecedents — evolución previa presentable (FR-042 · US10-AC6 · FR-039 · US10-AC7)", () => {
  const consulta = fila({
    id: "c-1",
    record_type: "consultation",
    content: { patientId: "paciente-1", status: "closed" },
    created_at: "2026-09-01T10:00:00.000Z",
  });

  test("expone la evolución con fecha de registro y fecha de consulta distinguibles", () => {
    const timeline = buildFeedbackTimeline([
      entrada(
        "fb-1",
        {
          consultationId: "c-1",
          adherence: "parcial",
          evolution: "mejoriaParcial",
          treatmentApplied: "Fluoxetina 20 mg cada 24 h",
          treatmentModification: "Dosis reducida a 10 mg",
          revisedDiagnosis: "Agresión redirigida",
          evolutionNote: "Mejora parcial de las ausencias.",
          adverseEvents: [{ severity: "leve", description: "Somnolencia leve" }],
        },
        { createdAt: "2026-09-22T09:00:00.000Z" },
      ),
    ]);

    const antecedentes = buildFeedbackAntecedents({ timeline, consultations: [consulta] });

    expect(antecedentes).toHaveLength(1);
    const antecedente = antecedentes[0];
    expect(antecedente?.feedbackRecordId).toBe("fb-1");
    expect(antecedente?.registeredAt).toBe("2026-09-22T09:00:00.000Z");
    expect(antecedente?.consultationDate).toBe("2026-09-01T10:00:00.000Z");
    expect(antecedente?.registeredAt).not.toBe(antecedente?.consultationDate);
    expect(antecedente?.adherence).toBe("parcial");
    expect(antecedente?.evolution).toBe("mejoriaParcial");
    expect(antecedente?.evolutionNote).toBe("Mejora parcial de las ausencias.");
    expect(antecedente?.adverseEvents).toEqual([
      { severity: "leve", description: "Somnolencia leve" },
    ]);
    expect(antecedente?.treatmentApplied).toBe("Fluoxetina 20 mg cada 24 h");
    expect(antecedente?.treatmentModification).toBe("Dosis reducida a 10 mg");
    expect(antecedente?.revisedDiagnosis).toBe("Agresión redirigida");
  });

  test("expone solo la versión vigente de cada cadena y excluye la consulta en curso", () => {
    const timeline = buildFeedbackTimeline([
      entrada(
        "fb-original",
        { consultationId: "c-1", adherence: "parcial" },
        { createdAt: "2026-09-01T09:00:00.000Z" },
      ),
      entrada(
        "fb-corr",
        { consultationId: "c-1", adherence: "completa" },
        { createdAt: "2026-09-15T09:00:00.000Z", correctsRecordId: "fb-original", status: "corrective" },
      ),
      entrada(
        "fb-2",
        { consultationId: "c-2", adherence: "ninguna" },
        { createdAt: "2026-09-22T09:00:00.000Z" },
      ),
    ]);

    const antecedentes = buildFeedbackAntecedents({
      timeline,
      consultations: [consulta],
      excludeConsultationId: "c-2",
    });

    expect(antecedentes.map((item) => item.feedbackRecordId)).toEqual(["fb-corr"]);
    expect(antecedentes[0]?.adherence).toBe("completa");
  });
});

describe("presupuestos de rendimiento (design.md)", () => {
  test("buildFeedbackTimeline + aggregateFeedback sobre 100 entradas en ≤ 300 ms", () => {
    const entradas: FeedbackEntry[] = Array.from({ length: 100 }, (_, indice) =>
      entrada(
        `fb-${String(indice).padStart(3, "0")}`,
        { consultationId: `c-${indice % 5}` },
        { createdAt: new Date(1758000000000 + indice * 1000).toISOString() },
      ),
    );

    const inicio = performance.now();
    const timeline = buildFeedbackTimeline(entradas);
    aggregateFeedback(timeline);
    const transcurrido = performance.now() - inicio;

    expect(timeline).toHaveLength(100);
    expect(transcurrido).toBeLessThanOrEqual(300);
  });
});
