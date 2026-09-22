import { beforeAll, describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAnamnesisEntries, recordAnamnesisEntry } from "@/features/registro/anamnesis-service";
import {
  getConsultation,
  listPatientTimeline,
  openConsultation,
  resumeConsultation,
} from "@/features/registro/consultation-service";
import { listDiagnoses, recordDiagnosis } from "@/features/registro/diagnosis-service";
import {
  approveEpicrisis,
  correctEpicrisis,
  generateEpicrisisDraft,
  listEpicrisisByConsultation,
  updateEpicrisisDraft,
} from "@/features/registro/epicrisis-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import type { EpicrisisContent } from "@/features/registro/schema";
import { effectiveEpicrisis } from "@/features/registro/summaries";
import type { Database } from "@/lib/supabase/database.types";
import { ANA, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";

/**
 * Flujo de epicrisis contra Supabase viva (FR-010, FR-011, FR-012, FR-024, FR-045 · US3, US4).
 * Solo corre en el job `database` de CI (`SUPABASE_LIVE_TESTS=1`); localmente queda en skip.
 *
 * Umbral laxo de tiempo por operación: estas operaciones no están presupuestadas en
 * `design.md` y el entorno de CI comparte recursos; se fija en 5 s para delatar solo
 * patologías, no ruido de vecindario.
 */
const UMBRAL_LAXO_MS = 5000;

async function abrirCaso(
  client: SupabaseClient<Database>,
  clinicId: string,
  patientId: string,
  sufijo: string,
): Promise<string> {
  const abierta = await openConsultation(client, { clinicId, patientId });
  await recordAnamnesisEntry(client, {
    clinicId,
    consultationId: abierta.record.id,
    field: "motivo_consulta",
    text: `Ladra de noche ${sufijo}.`,
    provenance: "reportada",
  });
  await recordDiagnosis(client, {
    clinicId,
    consultationId: abierta.record.id,
    text: "Ansiedad por separación",
  });
  return abierta.record.id;
}

async function editarBorrador(
  client: SupabaseClient<Database>,
  consultationId: string,
  cambios: Partial<EpicrisisContent>,
): Promise<EpicrisisContent> {
  const versiones = await listEpicrisisByConsultation(client, consultationId);
  const compuesta = versiones.at(-1)?.content;
  if (!compuesta) {
    throw new Error("El borrador de epicrisis debía existir.");
  }
  const editado: EpicrisisContent = { ...compuesta, ...cambios };
  await updateEpicrisisDraft(client, versiones.at(-1)?.record.id ?? "", editado);
  return editado;
}

describe.skipIf(!isLiveSupabase)("epicrisis contra Supabase viva", () => {
  let ana: LiveVeterinarian;
  let patientId = "";

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    const alta = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: {
        name: "Nala integración",
        species: "perro",
        breed: "Mestizo",
        birthDate: "2019-06-01",
        ageMonths: 84,
        weightKg: 18.5,
        sex: "hembra",
        reproductiveStatus: "esterilizada",
        antecedentes: {
          medicalHistory: [{ text: "Displasia de cadera", negative: false }],
          preexistingDiseases: [],
          currentMedications: [],
          knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
          behavioralHistory: [],
        },
      },
      tutor: {
        newTutor: { name: "Sra. Rojas", phone: "+56 9 5555 5555", email: null },
      },
    });
    patientId = alta.record.id;
  });

  test("borrador editable generado desde la sesión (FR-011 · US3-AC1, D3)", async () => {
    const consulta = await abrirCaso(ana.client, ana.clinicId, patientId, "A");

    const inicio = performance.now();
    const borrador = await generateEpicrisisDraft(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consulta,
    });
    expect(performance.now() - inicio).toBeLessThan(UMBRAL_LAXO_MS);
    expect(borrador.record.record_type).toBe("epicrisis");
    expect(borrador.record.status).toBe("draft");

    const versiones = await listEpicrisisByConsultation(ana.client, consulta);
    const contenido = versiones.at(-1)?.content;
    expect(contenido?.motivoConsulta).toContain("Ladra de noche A.");
    expect(contenido?.diagnostico).toBe("Ansiedad por separación");
    expect(contenido?.antecedentesRelevantes).toContain("Displasia de cadera");
    expect(contenido?.antecedentesRelevantes).toContain("hallazgo negativo");
    expect(contenido?.hipotesis).toEqual([]);
    expect(contenido?.medicamentosAprobados).toEqual([]);

    const editado = await editarBorrador(ana.client, consulta, {
      recomendacionesTutor: "Evitar dejarlo solo más de 4 h.",
      planSeguimiento: { pendientes: ["Control en 15 días"] },
      observaciones: "Versión editable.",
    });
    const releidas = await listEpicrisisByConsultation(ana.client, consulta);
    expect(releidas.at(-1)?.content).toEqual(editado);
  });

  test("el borrador no entra al historial definitivo (FR-010 · US3-AC3)", async () => {
    const consulta = await abrirCaso(ana.client, ana.clinicId, patientId, "B");
    const borrador = await generateEpicrisisDraft(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consulta,
    });
    expect(borrador.record.status).toBe("draft");

    const versiones = await listEpicrisisByConsultation(ana.client, consulta);
    expect(
      effectiveEpicrisis(
        versiones.map((version) => version.record),
        consulta,
      ),
    ).toBeNull();
    const { history } = await listPatientTimeline(ana.client, patientId);
    expect(history.find((entrada) => entrada.consultationId === consulta)?.epicrisis).toBeNull();
  });

  test("aprobación con aprobador y momento que deja la versión en el historial y cierra la consulta (FR-012 · US3-AC2, D4)", async () => {
    const consulta = await abrirCaso(ana.client, ana.clinicId, patientId, "C");
    const borrador = await generateEpicrisisDraft(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consulta,
    });
    await editarBorrador(ana.client, consulta, {
      recomendacionesTutor: "Paseos cortos y frecuentes.",
      planSeguimiento: { pendientes: ["Control en 15 días"] },
    });

    const inicio = performance.now();
    const aprobada = await approveEpicrisis(ana.client, borrador.record.id);
    expect(performance.now() - inicio).toBeLessThan(UMBRAL_LAXO_MS);
    expect(aprobada.attribution.action).toBe("epicrisis_approved");
    expect(aprobada.attribution.actorId).toBe(ana.userId);
    expect(Number.isNaN(Date.parse(aprobada.attribution.occurredAt))).toBe(false);

    const versiones = await listEpicrisisByConsultation(ana.client, consulta);
    const fila = versiones.find((version) => version.record.id === borrador.record.id);
    expect(fila?.record.status).toBe("approved");
    expect(fila?.record.approved_by).toBe(ana.userId);
    expect(fila?.record.approved_at).toBeTruthy();

    // D4: la aprobación cierra la consulta vinculada en la misma transacción.
    const leida = await getConsultation(ana.client, consulta);
    expect(leida?.content.status).toBe("closed");

    // La versión aprobada queda en el historial definitivo.
    const { history } = await listPatientTimeline(ana.client, patientId);
    const entrada = history.find((registro) => registro.consultationId === consulta);
    expect(entrada?.status).toBe("closed");
    expect(entrada?.epicrisis).toEqual(fila?.content);
    expect(entrada?.epicrisisSuperseded).toBe(false);
  });

  test("corrección posterior como registro adicional con el original recuperable (FR-024 · US3-AC4, D8)", async () => {
    const consulta = await abrirCaso(ana.client, ana.clinicId, patientId, "D");
    const borrador = await generateEpicrisisDraft(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consulta,
    });
    const contenidoOriginal = await editarBorrador(ana.client, consulta, {
      planSeguimiento: { pendientes: ["Control en 15 días"] },
    });
    await approveEpicrisis(ana.client, borrador.record.id);

    const { data: eventos } = await ana.client
      .from("clinical_audit_events")
      .select("id, action")
      .eq("entity_id", borrador.record.id)
      .eq("action", "epicrisis_approved");
    const eventoAprobacion = eventos?.[0]?.id ?? "";
    expect(eventoAprobacion).not.toBe("");

    const inicio = performance.now();
    const correctiva1 = await correctEpicrisis(ana.client, borrador.record.id, {
      ...contenidoOriginal,
      observaciones: "Corregido: sin exámenes pendientes.",
    });
    expect(performance.now() - inicio).toBeLessThan(UMBRAL_LAXO_MS);
    expect(correctiva1.record.status).toBe("corrective");
    expect(correctiva1.record.supersedes_event_id).toBe(eventoAprobacion);

    // El original permanece legible e intocable y la correctiva más reciente es la efectiva.
    const trasPrimera = await listEpicrisisByConsultation(ana.client, consulta);
    const original = trasPrimera.find((version) => version.record.id === borrador.record.id);
    expect(original?.record.status).toBe("approved");
    expect(original?.content).toEqual(contenidoOriginal);
    expect(
      effectiveEpicrisis(
        trasPrimera.map((version) => version.record),
        consulta,
      )?.id,
    ).toBe(correctiva1.record.id);

    // Una corrección sucesiva apunta al MISMO evento epicrisis_approved original (D8).
    const correctiva2 = await correctEpicrisis(ana.client, correctiva1.record.id, {
      ...contenidoOriginal,
      observaciones: "Segunda corrección.",
    });
    expect(correctiva2.record.supersedes_event_id).toBe(eventoAprobacion);

    const trasSegunda = await listEpicrisisByConsultation(ana.client, consulta);
    expect(
      effectiveEpicrisis(
        trasSegunda.map((version) => version.record),
        consulta,
      )?.id,
    ).toBe(correctiva2.record.id);
    const { history } = await listPatientTimeline(ana.client, patientId);
    expect(
      history.find((entrada) => entrada.consultationId === consulta)?.epicrisisSuperseded,
    ).toBe(true);
  });

  test("los registros de la consulta anterior permanecen idénticos tras cerrar una segunda consulta (FR-024 · SC-009 · US4-AC2)", async () => {
    const consultaAnterior = await abrirCaso(ana.client, ana.clinicId, patientId, "E1");
    const borradorAnterior = await generateEpicrisisDraft(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaAnterior,
    });
    await approveEpicrisis(ana.client, borradorAnterior.record.id);

    const registros = async () => {
      const anamnesis = await listAnamnesisEntries(ana.client, consultaAnterior);
      const diagnosticos = await listDiagnoses(ana.client, consultaAnterior);
      return [...anamnesis, ...diagnosticos].map((entrada) => entrada.record);
    };
    const antes = await registros();

    // Segunda consulta completa que termina cerrada.
    const consultaNueva = await abrirCaso(ana.client, ana.clinicId, patientId, "E2");
    const borradorNuevo = await generateEpicrisisDraft(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaNueva,
    });
    await editarBorrador(ana.client, consultaNueva, {
      planSeguimiento: { pendientes: ["Control en 15 días"] },
    });
    await approveEpicrisis(ana.client, borradorNuevo.record.id);

    const despues = await registros();
    expect(despues).toEqual(antes);
  });

  test("retoma de consulta interrumpida sin contaminar el historial (FR-045 · US4-AC5)", async () => {
    const consulta = await abrirCaso(ana.client, ana.clinicId, patientId, "F");
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consulta,
      field: "frecuencia",
      text: "Todas las noches.",
      provenance: "reportada",
    });
    const borrador = await generateEpicrisisDraft(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consulta,
    });
    const editado = await editarBorrador(ana.client, consulta, {
      planSeguimiento: { pendientes: ["Retoma pendiente (F)"] },
      observaciones: "Retomar el lunes.",
    });

    // Interrupción: el contenido íntegro vuelve tal cual (incluye resumeConsultation).
    const retomada = await resumeConsultation(ana.client, consulta);
    expect(retomada?.consultation.content.status).toBe("open");
    expect(retomada?.anamnesis.map((entrada) => entrada.content.field)).toEqual([
      "motivo_consulta",
      "frecuencia",
    ]);
    expect(retomada?.diagnoses.map((entrada) => entrada.content.text)).toEqual([
      "Ansiedad por separación",
    ]);
    expect(retomada?.epicrisisDraft?.record.id).toBe(borrador.record.id);
    expect(retomada?.epicrisisDraft?.content).toEqual(editado);

    // La consulta en curso no contamina el historial ni el resumen de seguimiento.
    const { history, followUp } = await listPatientTimeline(ana.client, patientId);
    expect(history.find((entrada) => entrada.consultationId === consulta)?.epicrisis).toBeNull();
    expect(followUp.pendingItems).not.toContain("Retoma pendiente (F)");

    await approveEpicrisis(ana.client, borrador.record.id);
    expect(await resumeConsultation(ana.client, consulta)).toBeNull();
  });
});
