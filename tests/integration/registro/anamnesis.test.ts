import { beforeAll, describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  correctProvenance,
  listAnamnesisEntries,
  recordAnamnesisEntry,
} from "@/features/registro/anamnesis-service";
import { listPatientTimeline, openConsultation } from "@/features/registro/consultation-service";
import { listDiagnoses, recordDiagnosis } from "@/features/registro/diagnosis-service";
import {
  approveEpicrisis,
  generateEpicrisisDraft,
  listEpicrisisByConsultation,
  updateEpicrisisDraft,
} from "@/features/registro/epicrisis-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import type { Database } from "@/lib/supabase/database.types";
import {
  ANA,
  BRUNO,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

/**
 * Consulta, anamnesis y diagnóstico contra Supabase viva (FR-003, FR-004, FR-021 · US2, US3).
 * Solo corre en el job `database` de CI (`SUPABASE_LIVE_TESTS=1`); localmente queda en skip.
 *
 * Presupuesto de `design.md`: ≤ 2 s para abrir consulta con resumen con ≤ 3 consultas previas.
 */

async function cerrarConsulta(
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
    text: `Motivo previo ${sufijo}.`,
    provenance: "reportada",
  });
  await recordDiagnosis(client, {
    clinicId,
    consultationId: abierta.record.id,
    text: `Diagnóstico previo ${sufijo}.`,
  });
  const borrador = await generateEpicrisisDraft(client, {
    clinicId,
    consultationId: abierta.record.id,
  });
  const versiones = await listEpicrisisByConsultation(client, abierta.record.id);
  const compuesta = versiones.at(-1)?.content;
  if (!compuesta) {
    throw new Error("El borrador de epicrisis debía existir.");
  }
  await updateEpicrisisDraft(client, borrador.record.id, {
    ...compuesta,
    recomendacionesTutor: `Recomendación ${sufijo}.`,
    planSeguimiento: { pendientes: [`Control de peso en 30 días (${sufijo})`] },
  });
  await approveEpicrisis(client, borrador.record.id);
  return abierta.record.id;
}

describe.skipIf(!isLiveSupabase)("consulta y anamnesis contra Supabase viva", () => {
  let ana: LiveVeterinarian;
  let bruno: LiveVeterinarian;
  let patientId = "";
  let consultaId = "";

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    bruno = await signedInVeterinarian(BRUNO);
    const alta = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: {
        name: "Toby integración",
        species: "perro",
        breed: "Beagle",
        birthDate: "2020-01-15",
        ageMonths: 72,
        weightKg: 14.2,
        sex: "macho",
        reproductiveStatus: "entero",
        antecedentes: {
          medicalHistory: [],
          preexistingDiseases: [],
          currentMedications: [],
          knownAllergies: [],
          behavioralHistory: [],
        },
      },
      tutor: {
        newTutor: { name: "Sr. Soto", phone: null, email: "soto@example.test" },
      },
    });
    patientId = alta.record.id;
    // Tres consultas previas cerradas con epicrisis efectiva (presupuesto de rendimiento).
    await cerrarConsulta(ana.client, ana.clinicId, patientId, "uno");
    await cerrarConsulta(ana.client, ana.clinicId, patientId, "dos");
    await cerrarConsulta(ana.client, ana.clinicId, patientId, "tres");
  });

  test("apertura con fecha y profesional y resumen previo en ≤ 2 s (FR-003 · US2-AC1, FR-002/FR-013)", async () => {
    const inicio = performance.now();
    const abierta = await openConsultation(ana.client, {
      clinicId: ana.clinicId,
      patientId,
    });
    const { history, followUp } = await listPatientTimeline(ana.client, patientId);
    expect(performance.now() - inicio).toBeLessThan(2000);

    consultaId = abierta.record.id;
    expect(abierta.record.content).toEqual({ patientId, status: "open" });
    expect(Number.isNaN(Date.parse(abierta.record.created_at))).toBe(false);
    expect(abierta.attribution.actorId).toBe(ana.userId);
    expect(abierta.attribution.action).toBe("consultation_opened");

    expect(history).toHaveLength(4);
    const aperturas = history.map((entrada) => Date.parse(entrada.openedAt));
    expect(aperturas).toEqual([...aperturas].sort((a, b) => a - b));
    expect(followUp.previousDiagnoses).toEqual([
      "Diagnóstico previo uno.",
      "Diagnóstico previo dos.",
      "Diagnóstico previo tres.",
    ]);
    expect(followUp.pendingItems).toEqual([
      "Control de peso en 30 días (uno)",
      "Control de peso en 30 días (dos)",
      "Control de peso en 30 días (tres)",
    ]);
  });

  test("motivo y comportamiento problemático distinguibles en texto libre (FR-004 · US2-AC2)", async () => {
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaId,
      field: "motivo_consulta",
      text: "Ladra de noche.",
      provenance: "reportada",
    });
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaId,
      field: "comportamiento_problematico",
      text: "Destroza objetos cuando se queda solo.",
      provenance: "reportada",
    });

    const entradas = await listAnamnesisEntries(ana.client, consultaId);
    expect(
      entradas.find((entrada) => entrada.content.field === "motivo_consulta")?.content.text,
    ).toBe("Ladra de noche.");
    expect(
      entradas.find((entrada) => entrada.content.field === "comportamiento_problematico")?.content
        .text,
    ).toBe("Destroza objetos cuando se queda solo.");
  });

  test("procedencia por antecedente y campo sin dato ≠ hallazgo negativo (FR-021 · SC-024 · US2-AC3/AC4)", async () => {
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaId,
      field: "tratamientos_anteriores",
      text: "Fluoxetina en 2024.",
      provenance: "inferida",
    });
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaId,
      field: "alimentacion",
      text: "Sin datos sobre la dieta.",
      provenance: "desconocida",
    });

    const entradas = await listAnamnesisEntries(ana.client, consultaId);
    const inferida = entradas.find(
      (entrada) => entrada.content.field === "tratamientos_anteriores",
    );
    expect(inferida?.content.provenance).toBe("inferida");
    const desconocida = entradas.find((entrada) => entrada.content.field === "alimentacion");
    expect(desconocida?.content.provenance).toBe("desconocida");
    // Un campo sin registrar no aparece: «sin dato» no es un hallazgo negativo inventado.
    expect(entradas.find((entrada) => entrada.content.field === "ambiente")).toBeUndefined();
  });

  test("corrección de procedencia recuperable (FR-021 · US2-AC5)", async () => {
    const entradas = await listAnamnesisEntries(ana.client, consultaId);
    const corregida = entradas.find(
      (entrada) => entrada.content.field === "tratamientos_anteriores",
    );
    if (!corregida) {
      throw new Error("La entrada a corregir debía existir.");
    }

    const primera = await correctProvenance(ana.client, corregida.record.id, "reportada");
    expect(primera.attribution.action).toBe("anamnesis_corrected");

    const trasPrimera = await listAnamnesisEntries(ana.client, consultaId);
    const contenido = trasPrimera.find(
      (entrada) => entrada.record.id === corregida.record.id,
    )?.content;
    expect(contenido?.provenance).toBe("reportada");
    expect(contenido?.provenanceHistory).toEqual([{ provenance: "inferida" }]);
    expect(contenido?.text).toBe("Fluoxetina en 2024.");

    // La traza acredita qué hubo una corrección, quién y cuándo (D7).
    const { data: eventos } = await ana.client
      .from("clinical_audit_events")
      .select("action, actor_id, occurred_at")
      .eq("entity_id", corregida.record.id)
      .eq("action", "anamnesis_corrected");
    expect((eventos ?? []).length).toBeGreaterThanOrEqual(1);
    expect(eventos?.[0]?.actor_id).toBe(ana.userId);
    expect(Number.isNaN(Date.parse(eventos?.[0]?.occurred_at ?? ""))).toBe(false);

    // Una corrección sucesiva acumula la historia: lo superado queda recuperable.
    await correctProvenance(ana.client, corregida.record.id, "desconocida");
    const trasSegunda = await listAnamnesisEntries(ana.client, consultaId);
    expect(
      trasSegunda.find((entrada) => entrada.record.id === corregida.record.id)?.content
        .provenanceHistory,
    ).toEqual([{ provenance: "inferida" }, { provenance: "reportada" }]);
  });

  test("atribución al segundo veterinario por antecedente (FR-004 · US2-AC6, FR-063)", async () => {
    const registrada = await recordAnamnesisEntry(bruno.client, {
      clinicId: ana.clinicId,
      consultationId: consultaId,
      field: "ambiente",
      text: "Vive en departamento.",
      provenance: "reportada",
    });
    expect(registrada.attribution.actorId).toBe(bruno.userId);
    expect(registrada.record.created_by).toBe(bruno.userId);

    const entradas = await listAnamnesisEntries(ana.client, consultaId);
    expect(
      entradas.find((entrada) => entrada.content.field === "motivo_consulta")?.record.created_by,
    ).toBe(ana.userId);
  });

  test("diagnóstico registrado por el veterinario (US3-AC1)", async () => {
    const registrado = await recordDiagnosis(ana.client, {
      clinicId: ana.clinicId,
      consultationId: consultaId,
      text: "Ansiedad por separación",
    });
    expect(registrado.attribution.actorId).toBe(ana.userId);
    expect(registrado.attribution.action).toBe("diagnosis_recorded");

    const diagnosticos = await listDiagnoses(ana.client, consultaId);
    expect(diagnosticos.map((entrada) => entrada.content.text)).toEqual([
      "Ansiedad por separación",
    ]);
  });
});
