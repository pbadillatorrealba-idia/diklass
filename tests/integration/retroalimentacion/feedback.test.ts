import { beforeAll, describe, expect, test } from "bun:test";
import { listConsultationsByPatient } from "@/features/registro/consultation-service";
import type { ClinicalRecordRow } from "@/features/registro/summaries";
import {
  correctFeedbackEntry,
  createFeedbackEntry,
  listFeedbackByConsultation,
  listFeedbackByConsultations,
} from "@/features/retroalimentacion/feedback-service";
import {
  aggregateFeedback,
  buildFeedbackAntecedents,
  buildFeedbackTimeline,
  collectAdverseEvents,
} from "@/features/retroalimentacion/feedback-summary";
import type { FeedbackContent } from "@/features/retroalimentacion/schema";
import { approveClinicalRecord } from "@/lib/attribution/clinical-mutations";
import {
  ANA,
  BRUNO,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

/**
 * Retroalimentación clínica contra Supabase viva (FR-018, FR-024, FR-039, FR-040, FR-041,
 * FR-043, FR-056, FR-057, FR-070 · US10). Corre con `SUPABASE_LIVE_TESTS=1` (job `database`
 * de CI o stack local con podman); sin eso queda en skip.
 *
 * Presupuestos de design.md: ≤ 2 s por registro o corrección y ≤ 2 s para cargar el panel
 * completo (≤ 5 consultas, ≤ 30 entradas). A diferencia del umbral laxo de otras suites, aquí
 * el presupuesto es el acordado del cambio y se verifica tal cual.
 */
const UMBRAL_OPERACION_MS = 2000;

const contenido = (
  consultationId: string,
  extra: Partial<FeedbackContent> = {},
): FeedbackContent => {
  const base: FeedbackContent = {
    consultationId,
    treatmentApplied: "Fluoxetina 20 mg cada 24 h",
    adherence: "parcial",
    evolution: "mejoriaParcial",
    evolutionNote: "Mejora parcial de las ausencias.",
    adverseEvents: [{ severity: "leve", description: "Somnolencia leve la primera semana" }],
    revisedDiagnosis: null,
    treatmentModification: "Dosis reducida a 10 mg cada 24 h por somnolencia",
  };
  // Variante parcial por prueba; el spread sobre campos opcionales se acota al tipo de salida.
  const variante = { ...base, ...extra };
  return variante as FeedbackContent;
};

describe.skipIf(!isLiveSupabase)("retroalimentación clínica contra Supabase viva", () => {
  let ana: LiveVeterinarian;
  let bruno: LiveVeterinarian;
  let patientId: string;
  let primeraConsultaId: string;
  let segundaConsultaId: string;
  let consultaAbiertaId: string;
  let diagnosticoPrevio: ClinicalRecordRow;
  let epicrisisPrevia: ClinicalRecordRow;

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    bruno = await signedInVeterinarian(BRUNO);

    const { data: paciente, error: errorPaciente } = await ana.client
      .from("clinical_records")
      .insert({
        clinic_id: ana.clinicId,
        record_type: "patient",
        content: { name: "Luna Retro Live" },
        status: "draft",
      })
      .select("id")
      .single();
    if (errorPaciente || !paciente) {
      throw errorPaciente ?? new Error("No se pudo crear el paciente de la prueba.");
    }
    patientId = paciente.id;

    const abrir = async (): Promise<string> => {
      const { data: consulta, error } = await ana.client
        .from("clinical_records")
        .insert({
          clinic_id: ana.clinicId,
          record_type: "consultation",
          content: { patientId, status: "open" },
          status: "draft",
        })
        .select("id")
        .single();
      if (error || !consulta) {
        throw error ?? new Error("No se pudo abrir la consulta de la prueba.");
      }
      return consulta.id;
    };

    primeraConsultaId = await abrir();
    segundaConsultaId = await abrir();
    consultaAbiertaId = await abrir();

    const { data: diagnostico, error: errorDiagnostico } = await ana.client
      .from("clinical_records")
      .insert({
        clinic_id: ana.clinicId,
        record_type: "diagnosis",
        content: { consultationId: primeraConsultaId, text: "Ansiedad por separación" },
        status: "draft",
      })
      .select("*")
      .single();
    if (errorDiagnostico || !diagnostico) {
      throw errorDiagnostico ?? new Error("No se pudo registrar el diagnóstico de la prueba.");
    }
    diagnosticoPrevio = diagnostico;

    // D4 de 002: aprobar la epicrisis cierra su consulta en la misma transacción.
    const cerrar = async (consultationId: string): Promise<void> => {
      const { data: epicrisis, error } = await ana.client
        .from("clinical_records")
        .insert({
          clinic_id: ana.clinicId,
          record_type: "epicrisis",
          content: {
            consultationId,
            motivoConsulta: "Ansiedad por separación",
            diagnostico: "Ansiedad por separación",
            medicamentosAprobados: ["Fluoxetina 20 mg cada 24 h"],
            intervencionesPropuestas: ["Manejo ambiental"],
            planSeguimiento: { pendientes: ["Control en 4 semanas"] },
          },
          status: "draft",
        })
        .select("id")
        .single();
      if (error || !epicrisis) {
        throw error ?? new Error("No se pudo generar la epicrisis de la prueba.");
      }
      await approveClinicalRecord(ana.client, epicrisis.id);
      if (consultationId === primeraConsultaId) {
        const { data: fila } = await ana.client
          .from("clinical_records")
          .select("*")
          .eq("id", epicrisis.id)
          .single();
        if (!fila) {
          throw new Error("No se pudo releer la epicrisis de la prueba.");
        }
        epicrisisPrevia = fila;
      }
    };

    await cerrar(primeraConsultaId);
    await cerrar(segundaConsultaId);

    // Fixture de lectura para los tests de agregación y antecedentes (convención de 002: el
    // estado que los tests solo LEEN se arma aquí; cada test muta únicamente su propio sujeto).
    await createFeedbackEntry(ana.client, {
      clinicId: ana.clinicId,
      content: contenido(segundaConsultaId, {
        adherence: "desconocida",
        evolution: "desconocida",
        treatmentApplied: null,
        treatmentModification: null,
        adverseEvents: [{ severity: "grave", description: "Convulsión aislada" }],
      }),
    });
  });

  test("registra la evolución sobre la consulta cerrada, atribuida a quien la registra (FR-018 · US10-AC1 · FR-070 · SC-049 · US10-AC13)", async () => {
    const inicio = performance.now();
    const resultado = await createFeedbackEntry(bruno.client, {
      clinicId: ana.clinicId,
      content: contenido(primeraConsultaId),
    });
    const transcurrido = performance.now() - inicio;

    expect(transcurrido).toBeLessThanOrEqual(UMBRAL_OPERACION_MS);
    expect(resultado.record.record_type).toBe("clinical_feedback");
    expect(resultado.record.created_by).toBe(bruno.userId);
    expect(resultado.attribution.actorId).toBe(bruno.userId);
    expect(resultado.attribution.action).toBe("clinical_feedback_recorded");
  });

  test("la epicrisis aprobada y el diagnóstico original permanecen idénticos (FR-024 · SC-022 · US10-AC3/AC4)", async () => {
    const { data: diagnostico } = await ana.client
      .from("clinical_records")
      .select("*")
      .eq("id", (diagnosticoPrevio as { id: string }).id)
      .single();
    const { data: epicrisis } = await ana.client
      .from("clinical_records")
      .select("*")
      .eq("id", (epicrisisPrevia as { id: string }).id)
      .single();

    expect(diagnostico).toEqual(diagnosticoPrevio);
    expect(epicrisis).toEqual(epicrisisPrevia);
  });

  test("el servicio rechaza registrar sobre una consulta aún abierta, sin escribir nada (D3; el gate del servidor lo verifica el assert 20 de la suite 012)", async () => {
    await expect(
      createFeedbackEntry(ana.client, {
        clinicId: ana.clinicId,
        content: contenido(consultaAbiertaId),
      }),
    ).rejects.toThrow("solo sobre consultas cerradas");
  });

  test("el servidor rechaza vocabularios fuera de enumerado aunque se evite el servicio (FR-040 · FR-043 · SC-023 · D5)", async () => {
    const resultado = await ana.client.from("clinical_records").insert({
      clinic_id: ana.clinicId,
      record_type: "clinical_feedback",
      content: { ...contenido(primeraConsultaId), adherence: "quizas" },
      status: "draft",
    });

    expect(resultado.error?.code).toBe("23514");
    expect(resultado.error?.message).toContain("CLINICAL_FEEDBACK_INVALID_CONTENT");
  });

  test("la entrada registrada es inmutable ante un UPDATE directo (FR-024 · SC-022 · US10-AC5)", async () => {
    const entradas = await listFeedbackByConsultation(ana.client, primeraConsultaId);
    const original = entradas[0];
    expect(original).toBeDefined();
    if (!original) {
      throw new Error("No se recuperó la entrada original.");
    }

    const resultado = await ana.client
      .from("clinical_records")
      .update({ content: { ...original.content, adherence: "completa" } })
      .eq("id", original.record.id);

    expect(resultado.error?.code).toBe("23514");
    expect(resultado.error?.message).toContain("CLINICAL_FEEDBACK_IMMUTABLE");
  });

  test("la corrección es un registro nuevo y el original permanece recuperable (FR-024 · SC-022 · US10-AC5)", async () => {
    const entradas = await listFeedbackByConsultation(ana.client, primeraConsultaId);
    const original = entradas[0];
    expect(original).toBeDefined();
    if (!original) {
      throw new Error("No se recuperó la entrada original.");
    }
    const originalId = original.record.id;

    const inicio = performance.now();
    const correccion = await correctFeedbackEntry(ana.client, originalId, {
      ...original.content,
      adherence: "completa",
    });
    const transcurrido = performance.now() - inicio;

    expect(transcurrido).toBeLessThanOrEqual(UMBRAL_OPERACION_MS);
    expect(correccion.record.id).not.toBe(originalId);
    expect(correccion.record.status).toBe("corrective");
    expect(correccion.record.supersedes_event_id).not.toBeNull();

    const { data: originalDespues } = await ana.client
      .from("clinical_records")
      .select("*")
      .eq("id", originalId)
      .single();
    expect(originalDespues).toEqual(original.record);
  });

  test("varias entradas conviven en orden cronológico y los categóricos se agregan sin texto libre (FR-056 · FR-043 · SC-023 · US10-AC9/AC11)", async () => {
    const consultas = await listConsultationsByPatient(ana.client, patientId);
    const entradas = await listFeedbackByConsultations(
      ana.client,
      consultas.map((entrada) => entrada.record.id),
    );
    expect(entradas.length).toBeGreaterThanOrEqual(3);

    const timeline = buildFeedbackTimeline(entradas);
    expect(timeline.filter((entrada) => entrada.effective).length).toBe(2);

    const agregados = aggregateFeedback(timeline);
    expect(agregados.total).toBe(2);
    expect(agregados.adherence.completa).toBe(1);
    expect(agregados.adherence.desconocida).toBe(1);
    expect(agregados.adherence.parcial).toBe(0);
    expect(agregados.evolution.desconocida).toBe(1);
    expect(agregados.adverseEvents.grave).toBe(1);
  });

  test("los eventos adversos se recuperan diferenciados y la evolución previa como antecedente con ambas fechas (FR-041 · SC-035 · FR-042 · US10-AC6 · FR-039 · US10-AC7)", async () => {
    const inicio = performance.now();
    const consultas = await listConsultationsByPatient(ana.client, patientId);
    const entradas = await listFeedbackByConsultations(
      ana.client,
      consultas.map((entrada) => entrada.record.id),
    );
    const timeline = buildFeedbackTimeline(entradas);
    const eventos = collectAdverseEvents(timeline);
    const antecedentes = buildFeedbackAntecedents({
      timeline,
      consultations: consultas.map((entrada) => entrada.record),
      excludeConsultationId: consultaAbiertaId,
    });
    const transcurrido = performance.now() - inicio;

    expect(transcurrido).toBeLessThanOrEqual(UMBRAL_OPERACION_MS);

    expect(eventos.length).toBeGreaterThanOrEqual(2);
    expect(eventos.some((item) => item.event.severity === "grave")).toBe(true);
    expect(eventos.every((item) => item.consultationId !== consultaAbiertaId)).toBe(true);

    expect(antecedentes.length).toBe(2);
    const antecedente = antecedentes.find((item) => item.consultationId === primeraConsultaId);
    expect(antecedente?.registeredAt).toBeDefined();
    expect(antecedente?.consultationDate).toBeDefined();
    expect(antecedente?.registeredAt).not.toBe(antecedente?.consultationDate);
    expect(antecedente?.adherence).toBe("completa");
    expect(antecedente?.treatmentApplied).toBe("Fluoxetina 20 mg cada 24 h");
    expect(antecedente?.treatmentModification).toBe(
      "Dosis reducida a 10 mg cada 24 h por somnolencia",
    );
  });
});
