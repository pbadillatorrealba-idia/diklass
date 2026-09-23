import { beforeAll, describe, expect, test } from "bun:test";
import {
  addVetHypothesis,
  decideHypothesis,
  generateDifferentialSupport,
  listHypotheses,
} from "@/features/asistencia/hipotesis-service";
import { composeHipotesisConsideradas } from "@/features/asistencia/soporte-diferencial";
import { incorporateSource } from "@/features/conocimiento/coleccion-service";
import type { FuenteContent } from "@/features/conocimiento/schema";
import { recordAnamnesisEntry } from "@/features/registro/anamnesis-service";
import { openConsultation } from "@/features/registro/consultation-service";
import { recordDiagnosis } from "@/features/registro/diagnosis-service";
import { createPatientFicha } from "@/features/registro/ficha-service";
import type { PatientContent } from "@/features/registro/schema";
import { ANA, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";

/**
 * Soporte diferencial contra Supabase viva (FR-009, FR-022, FR-023, FR-020, FR-029, FR-010,
 * FR-049 · US8). Presupuestos de `design.md`: generación completa ≤ 8 s y decisión ≤ 2 s.
 */

const termino = `separacion${Math.random().toString(36).slice(2)}`;

function fuenteNueva(): FuenteContent {
  return {
    bibliografia: {
      titulo: "Protocolo de ansiedad por separación (ficticio)",
      autores: ["Equipo clínico sintético"],
      anio: 2026,
      revista: null,
      editorial: null,
      edicion: null,
      doi: null,
      url: null,
    },
    licencia: { tipo: "CC BY 4.0 (ficticia)", nota: "Corpus sintético de demostración" },
    fragmentos: [
      {
        ordinal: 1,
        seccion: "Síntesis",
        texto: `La ansiedad por separación se reconoce por la conducta destructiva en ausencia del tutor, con el criterio ${termino}.`,
      },
    ],
  };
}

function fichaBase(): Omit<PatientContent, "tutorId"> {
  return {
    name: "Luna Soporte",
    species: "perro",
    breed: "Mestizo",
    birthDate: "2021-05-01",
    ageMonths: 36,
    weightKg: 12.4,
    sex: "hembra",
    reproductiveStatus: "esterilizada",
    antecedentes: {
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [],
      behavioralHistory: [],
    },
  };
}

describe.skipIf(!isLiveSupabase)("soporte diferencial (US8)", () => {
  let ana: LiveVeterinarian;
  let consultationId: string;
  let patientId: string;

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    await incorporateSource(ana.client, { clinicId: ana.clinicId, fuente: fuenteNueva() });
    const ficha = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      tutor: { newTutor: { name: "Sra. Soporte", phone: "+56 9 5555 6666", email: null } },
      ficha: fichaBase(),
    });
    patientId = ficha.record.id;
    const consulta = await openConsultation(ana.client, {
      clinicId: ana.clinicId,
      patientId,
    });
    consultationId = consulta.record.id;
  });

  test("FR-022 · US8-AC5: con anamnesis insuficiente se declara la insuficiencia y no se proponen hipótesis", async () => {
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      field: "motivo_consulta",
      text: `Destroza objetos ${termino}`,
      provenance: "reportada",
    });
    const { suficiencia, hipotesis } = await generateDifferentialSupport(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
    });
    expect(suficiencia.estado).toBe("insuficiente");
    expect(suficiencia.faltantes.length).toBeGreaterThan(0);
    expect(hipotesis).toHaveLength(0);
  });

  test("FR-009 · SC-019 · FR-020 · US8-AC1: la generación presenta la hipótesis citada y la persiste reconstruible", async () => {
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      field: "comportamiento_problematico",
      text: `Destroza muebles y ladra en ausencia del tutor ${termino}`,
      provenance: "reportada",
    });
    await recordAnamnesisEntry(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      field: "contexto",
      text: "Ocurre cuando el animal queda solo",
      provenance: "reportada",
    });

    const inicio = performance.now();
    const { suficiencia, hipotesis } = await generateDifferentialSupport(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
    });
    expect(performance.now() - inicio).toBeLessThan(8000);
    expect(suficiencia.estado).toBe("suficiente");
    expect(hipotesis.length).toBeGreaterThan(0);

    const separacion = hipotesis.find(
      (hipotesisItem) => hipotesisItem.reglaId === "separationAnxiety",
    );
    expect(separacion).toBeDefined();
    expect(separacion?.analisis.aFavor.items.length).toBeGreaterThan(0);
    expect(separacion?.analisis.faltante.campos.length).toBeGreaterThan(0);
    expect(separacion?.respaldo.citas.length).toBeGreaterThan(0);
    if (separacion && separacion.respaldo.citas.length > 0) {
      // FR-007 · US8-AC10: el fragmento concreto, no solo su título — cita documento+fragmento
      // con texto verbatim de la colección compartida (cualquier fuente calificada es válida).
      expect(separacion.respaldo.citas[0]?.textoCitado.length).toBeGreaterThan(0);
      expect(separacion.respaldo.citas[0]?.documentoId.length).toBeGreaterThan(0);
    }
    expect(separacion?.descargo).toContain("no constituye un diagnóstico");

    const reconstruidas = await listHypotheses(ana.client, { consultationId });
    const reconstruida = reconstruidas.find((item) => item.reglaId === "separationAnxiety");
    expect(reconstruida?.insumos.anamnesis.length).toBeGreaterThan(0);
    expect(reconstruida?.insumos.terminosMatch.length).toBeGreaterThan(0);
    expect(reconstruida?.respaldo.knowledgeQueryId).not.toBeNull();
  });

  test("D7: regenerar no duplica la hipótesis ya presentada por su regla", async () => {
    const { hipotesis } = await generateDifferentialSupport(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
    });
    const presentadas = hipotesis.filter((item) => item.reglaId === "separationAnxiety");
    expect(presentadas).toHaveLength(1);
  });

  test("FR-029 · FR-063 · US8-AC2: aceptar y descartar registran las transiciones atribuidas", async () => {
    const reconstruidas = await listHypotheses(ana.client, { consultationId });
    const separacion = reconstruidas.find((item) => item.reglaId === "separationAnxiety");
    expect(separacion).toBeDefined();
    const inicio = performance.now();
    const aceptada = await decideHypothesis(ana.client, {
      hypothesisId: separacion?.key ?? "",
      decision: "accepted",
    });
    expect(performance.now() - inicio).toBeLessThan(2000);
    expect(aceptada.attribution.action).toBe("hypothesis_accepted");

    const descartada = await decideHypothesis(ana.client, {
      hypothesisId: separacion?.key ?? "",
      decision: "discarded",
    });
    expect(descartada.attribution.action).toBe("hypothesis_discarded");

    const trasDecision = await listHypotheses(ana.client, { consultationId });
    const decidida = trasDecision.find((item) => item.key === (separacion?.key ?? ""));
    expect(decidida?.decision).toBe("discarded");
  });

  test("FR-029 · US8-AC9 · SC-030: la hipótesis propia del veterinario se registra con su origen y sin respaldo declarado", async () => {
    const creada = await addVetHypothesis(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      texto: "Hipótesis propia del veterinario",
    });
    expect(creada.attribution.action).toBe("hypothesis_added");
    const reconstruidas = await listHypotheses(ana.client, { consultationId });
    const propia = reconstruidas.find((item) => item.texto === "Hipótesis propia del veterinario");
    expect(propia?.origen).toBe("veterinario");
    expect(propia?.respaldo.sinRespaldo).toBe(true);
  });

  test("FR-049 · US8-AC6: las hipótesis quedan disponibles para la epicrisis con su estado", async () => {
    const reconstruidas = await listHypotheses(ana.client, { consultationId });
    const contenidos = reconstruidas.map((item) => ({
      consultationId,
      texto: item.texto,
      decision: item.decision,
      origen: item.origen,
      reglaId: item.reglaId,
      insumos: item.insumos,
      respaldo: item.respaldo,
    }));
    const consideradas = composeHipotesisConsideradas(contenidos);
    expect(consideradas.some((item) => item.estado === "descartada")).toBe(true);
    expect(consideradas.some((item) => item.estado === "propuesta")).toBe(true);
  });

  test("caso límite: el diagnóstico del veterinario se registra sin fricción aunque ninguna hipótesis lo anticipe", async () => {
    const registrado = await recordDiagnosis(ana.client, {
      clinicId: ana.clinicId,
      consultationId,
      text: "Diagnóstico propio ajeno a toda hipótesis",
    });
    expect(registrado.attribution.action).toBe("diagnosis_recorded");
  });
});
