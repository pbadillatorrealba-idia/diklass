import { beforeAll, describe, expect, test } from "bun:test";
import { incorporateSource, withdrawSource } from "@/features/conocimiento/coleccion-service";
import { consultKnowledge, getQuery, listQueries } from "@/features/conocimiento/consulta-service";
import type { FuenteContent } from "@/features/conocimiento/schema";
import { createPatientFicha } from "@/features/registro/ficha-service";
import type { PatientContent } from "@/features/registro/schema";
import { ANA, BRUNO, isLiveSupabase, type LiveVeterinarian, signedInVeterinarian } from "../live-supabase";

/**
 * Consulta al asistente contra Supabase viva (FR-005, FR-006, FR-007, FR-020, FR-021,
 * FR-022, FR-023, FR-026, FR-051, FR-053 · US5). Presupuestos de `design.md`:
 * recuperación ≤ 500 ms, consulta completa ≤ 3 s y resolución de cita ≤ 1 s.
 */

function fuenteNueva(titulo: string, texto: string): FuenteContent {
  return {
    bibliografia: {
      titulo,
      autores: ["Equipo clínico sintético"],
      anio: 2026,
      revista: null,
      editorial: null,
      edicion: null,
      doi: null,
      url: null,
    },
    licencia: { tipo: "CC BY 4.0 (ficticia)", nota: "Corpus sintético de demostración" },
    fragmentos: [{ ordinal: 1, seccion: "Síntesis", texto }],
  };
}

function fichaBase(nombre: string): Omit<PatientContent, "tutorId"> {
  return {
    name: nombre,
    species: "perro",
    breed: "Mestizo",
    birthDate: "2021-05-01",
    ageMonths: 36,
    weightKg: 12.4,
    sex: "hembra",
    reproductiveStatus: "esterilizada",
    antecedentes: {
      medicalHistory: [{ text: "Displasia de cadera", negative: false }],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [{ text: "Alergia a la penicilina", negative: false }],
      behavioralHistory: [],
    },
  };
}

describe.skipIf(!isLiveSupabase)("consulta al asistente (US5)", () => {
  let ana: LiveVeterinarian;
  let bruno: LiveVeterinarian;
  let documentId: string;
  let patientId: string;
  const termino = `zurdismo${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    bruno = await signedInVeterinarian(BRUNO);

    const alta = await incorporateSource(ana.client, {
      clinicId: ana.clinicId,
      fuente: fuenteNueva(
        "Protocolo de habituación zurdísima (ficticio)",
        `La habituación zurdísima al transportín exige sesiones breves de habituar con ${termino}.`,
      ),
    });
    documentId = alta.record.record.id;

    const ficha = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      tutor: { newTutor: { name: "Sra. Consulta", phone: "+56 9 1111 2222", email: null } },
      ficha: fichaBase("Luna Consulta"),
    });
    patientId = ficha.record.id;
  });

  test("la pregunta en lenguaje natural responde con cita documento+fragmento y su bibliografia (FR-005 · FR-006 · FR-007 · US5-AC1)", async () => {
    const inicio = performance.now();
    const { answer } = await consultKnowledge(ana.client, {
      clinicId: ana.clinicId,
      pregunta: `¿Cómo habituar de forma zurdísima ${termino}?`,
      patientId: null,
    });
    expect(performance.now() - inicio).toBeLessThan(3000);

    const evidencia = answer.segmentos.find(
      (s) => s.kind === "evidencia" && s.cita.documentoId === documentId,
    );
    if (evidencia?.kind !== "evidencia") throw new Error("sin evidencia de la fuente incorporada");
    expect(evidencia.cita.textoCitado).toContain(termino);
    expect(evidencia.cita.bibliografia.titulo).toBe("Protocolo de habituación zurdísima (ficticio)");
  });

  test("la respuesta combina fuente, ficha e inferencia con sus procedencias (FR-021 · US5-AC3)", async () => {
    const { answer } = await consultKnowledge(ana.client, {
      clinicId: ana.clinicId,
      pregunta: `¿Cómo habituar de forma zurdísima ${termino}?`,
      patientId,
    });

    const kinds = answer.segmentos.map((s) => s.kind);
    expect(kinds).toContain("evidencia");
    expect(kinds).toContain("ficha");
    expect(kinds).toContain("inferencia");
    const ficha = answer.segmentos.filter((s) => s.kind === "ficha");
    expect(ficha.some((s) => s.kind === "ficha" && s.fichaRef === "name")).toBe(true);
  });

  test("pregunta sin cobertura documental declara la ausencia de respaldo (FR-023 · SC-025 · US5-AC2)", async () => {
    const { answer } = await consultKnowledge(ana.client, {
      clinicId: ana.clinicId,
      pregunta: "¿Qué dosis de quimioterapia felina oncólogica usar?",
      patientId: null,
    });
    expect(answer.avisos).toContain("sin_respaldo_documental");
    expect(answer.segmentos.filter((s) => s.kind === "evidencia")).toHaveLength(0);
  });

  test("varias preguntas con el mismo paciente se reconstruyen con lo que produjeron la recomendación (FR-020 · FR-026 · US5-AC4/AC5)", async () => {
    const primera = await consultKnowledge(ana.client, {
      clinicId: ana.clinicId,
      pregunta: `¿Cómo habituar de forma zurdísima ${termino}?`,
      patientId,
    });
    const segunda = await consultKnowledge(bruno.client, {
      clinicId: bruno.clinicId,
      pregunta: `¿Cómo habituar de forma zurdísima ${termino}?`,
      patientId,
    });

    const registro = await listQueries(ana.client);
    expect(registro.some((fila) => fila.id === primera.queryId)).toBe(true);
    expect(registro.some((fila) => fila.id === segunda.queryId)).toBe(true);

    const inicio = performance.now();
    const reconstruida = await getQuery(ana.client, primera.queryId);
    expect(performance.now() - inicio).toBeLessThan(1000);
    expect(reconstruida?.row.patient_id).toBe(patientId);
    expect(reconstruida?.answer.patientId).toBe(patientId);
    const segmentos = reconstruida?.answer.segmentos ?? [];
    expect(segmentos.some((s) => s.kind === "ficha")).toBe(true);
    expect(segmentos.some((s) => s.kind === "evidencia")).toBe(true);
  });

  test("una fuente retirada deja la cita identificable y marcada al reconstruir (FR-053 · US5-AC12)", async () => {
    const { queryId } = await consultKnowledge(ana.client, {
      clinicId: ana.clinicId,
      pregunta: `¿Cómo habituar de forma zurdísima ${termino}?`,
      patientId: null,
    });

    await withdrawSource(bruno.client, { documentId });

    const reconstruida = await getQuery(ana.client, queryId);
    expect(reconstruida?.answer.avisos).toContain("fuente_retirada");
    const evidencia = reconstruida?.answer.segmentos.find(
      (s) => s.kind === "evidencia" && s.cita.documentoId === documentId,
    );
    if (evidencia?.kind !== "evidencia") throw new Error("sin evidencia de la fuente retirada");
    expect(evidencia.cita.textoCitado).toContain(termino);
    expect(evidencia.cita.estado).toBe("withdrawn");
  });
});
