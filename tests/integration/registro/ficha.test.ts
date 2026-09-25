import { beforeAll, describe, expect, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAnamnesisEntry } from "@/features/registro/anamnesis-service";
import { openConsultation } from "@/features/registro/consultation-service";
import { recordDiagnosis } from "@/features/registro/diagnosis-service";
import {
  approveEpicrisis,
  generateEpicrisisDraft,
  listEpicrisisByConsultation,
} from "@/features/registro/epicrisis-service";
import {
  addAntecedentItem,
  createPatientFicha,
  getPatient,
  listPatients,
  updatePatientFicha,
} from "@/features/registro/ficha-service";
import type { PatientContent } from "@/features/registro/schema";
import {
  type ClinicalRecordRow,
  computeMissingFichaFields,
  effectiveEpicrisis,
} from "@/features/registro/summaries";
import { listTutors, updateTutor } from "@/features/registro/tutor-service";
import type { Database } from "@/lib/supabase/database.types";
import {
  ANA,
  BRUNO,
  isLiveSupabase,
  type LiveVeterinarian,
  signedInVeterinarian,
} from "../live-supabase";

/**
 * Ficha y tutor contra Supabase viva (FR-001, FR-027, FR-044 · US1). Solo corre en el job
 * `database` de CI (`SUPABASE_LIVE_TESTS=1`); localmente queda en skip.
 *
 * Presupuestos de `design.md`: ≤ 2 s por operación de ficha y ≤ 2 s para listar con ≤ 200
 * pacientes.
 */

function fichaBase(
  nombre: string,
  cambios: Partial<Omit<PatientContent, "tutorId">> = {},
): Omit<PatientContent, "tutorId"> {
  return {
    name: nombre,
    species: "perro",
    breed: "Mestizo",
    birthDate: "2021-05-01",
    ageMonths: 24,
    weightKg: 12.4,
    sex: "hembra",
    reproductiveStatus: "esterilizada",
    antecedentes: {
      medicalHistory: [{ text: "Displasia de cadera", negative: false }],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [],
      behavioralHistory: [],
    },
    ...cambios,
  };
}

async function epicrisisEfectiva(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<ClinicalRecordRow | null> {
  const versiones = await listEpicrisisByConsultation(client, consultationId);
  return effectiveEpicrisis(
    versiones.map((version) => version.record),
    consultationId,
  );
}

/** Caso clínico cerrado (consulta + epicrisis aprobada) para los casos límite de la spec. */
async function provisionarCasoCerrado(
  client: SupabaseClient<Database>,
  clinicId: string,
  nombre: string,
): Promise<{ consultationId: string; patientId: string; tutorId: string }> {
  const alta = await createPatientFicha(client, {
    clinicId,
    ficha: fichaBase(nombre),
    tutor: {
      newTutor: { name: `Tutor de ${nombre}`, phone: "+56 9 3333 3333", email: null },
    },
  });
  const abierta = await openConsultation(client, { clinicId, patientId: alta.record.id });
  await recordAnamnesisEntry(client, {
    clinicId,
    consultationId: abierta.record.id,
    field: "motivo_consulta",
    text: "Ladra de noche.",
    provenance: "reportada",
  });
  await recordDiagnosis(client, {
    clinicId,
    consultationId: abierta.record.id,
    text: "Ansiedad por separación",
  });
  const borrador = await generateEpicrisisDraft(client, {
    clinicId,
    consultationId: abierta.record.id,
  });
  await approveEpicrisis(client, borrador.record.id);
  return {
    consultationId: abierta.record.id,
    patientId: alta.record.id,
    tutorId: alta.tutorId,
  };
}

describe.skipIf(!isLiveSupabase)("ficha y tutor contra Supabase viva", () => {
  let ana: LiveVeterinarian;
  let tutorId = "";
  let pacienteId = "";
  let caso: { consultationId: string; patientId: string; tutorId: string };

  beforeAll(async () => {
    ana = await signedInVeterinarian(ANA);
    caso = await provisionarCasoCerrado(ana.client, ana.clinicId, "Caso límite integración");
    // Fixtures compartidos creados en beforeAll: los tests no consumen estado creado por
    // otros tests (un fallo del primero no puede cascading en los demás).
    const compartida = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: fichaBase("Luna compartida"),
      tutor: { newTutor: { name: "Sra. Pérez compartida", phone: "+56 9 1111 2222", email: null } },
    });
    tutorId = compartida.tutorId;
    pacienteId = compartida.record.id;
    await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: fichaBase("Simón compartida"),
      tutor: { existingTutorId: compartida.tutorId },
    });
  });

  test("alta con tutor nuevo y segundo paciente sin duplicar tutor (FR-001 · US1-AC1, FR-027 · US1-AC4)", async () => {
    const inicio = performance.now();
    const alta = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: fichaBase("Luna integración"),
      tutor: { newTutor: { name: "Sra. Pérez", phone: "+56 9 1111 1111", email: null } },
    });
    expect(performance.now() - inicio).toBeLessThan(2000);

    expect(alta.tutorId).toBeTruthy();
    expect(alta.attribution.actorId).toBe(ana.userId);
    expect(alta.attribution.action).toBe("patient_created");

    const inicioSegundo = performance.now();
    const segundo = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: fichaBase("Simón integración"),
      tutor: { existingTutorId: alta.tutorId },
    });
    expect(performance.now() - inicioSegundo).toBeLessThan(2000);

    expect(segundo.tutorId).toBe(alta.tutorId);

    // Un único tutor para dos pacientes: no se duplicó (US1-AC4).
    const tutores = await listTutors(ana.client);
    expect(tutores.filter((entrada) => entrada.record.id === alta.tutorId)).toHaveLength(1);
    const luna = await getPatient(ana.client, alta.record.id);
    const simon = await getPatient(ana.client, segundo.record.id);
    expect(luna?.content.tutorId).toBe(alta.tutorId);
    expect(simon?.content.tutorId).toBe(alta.tutorId);
  });

  test("ampliación con antecedentes sin perder los datos previos (FR-001 · US1-AC2)", async () => {
    const inicioEnfermedad = performance.now();
    await addAntecedentItem(ana.client, pacienteId, "preexistingDiseases", {
      text: "Hipotiroidismo",
      negative: false,
    });
    expect(performance.now() - inicioEnfermedad).toBeLessThan(2000);

    const inicioAlergia = performance.now();
    await addAntecedentItem(ana.client, pacienteId, "knownAllergies", {
      text: "Sin alergias conocidas",
      negative: true,
    });
    expect(performance.now() - inicioAlergia).toBeLessThan(2000);

    const despues = await getPatient(ana.client, pacienteId);
    expect(despues?.content.antecedentes.medicalHistory).toEqual([
      { text: "Displasia de cadera", negative: false },
    ]);
    expect(despues?.content.antecedentes.preexistingDiseases).toEqual([
      { text: "Hipotiroidismo", negative: false },
    ]);
    expect(despues?.content.antecedentes.knownAllergies).toEqual([
      { text: "Sin alergias conocidas", negative: true },
    ]);
  });

  test("ficha incompleta aceptada y marcada, sin confundirse con hallazgos negativos (FR-044 · SC-024 · US1-AC3)", async () => {
    const inicio = performance.now();
    const incompleta = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: {
        name: "Mora integración",
        species: "gato",
        breed: "Común",
        birthDate: null,
        ageMonths: null,
        weightKg: null,
        sex: "hembra",
        reproductiveStatus: "entera",
        antecedentes: {
          medicalHistory: [],
          preexistingDiseases: [],
          currentMedications: [],
          knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
          behavioralHistory: [],
        },
      },
      tutor: { existingTutorId: tutorId },
    });
    expect(performance.now() - inicio).toBeLessThan(2000);
    expect(incompleta.record.id).toBeTruthy();

    const lectura = await getPatient(ana.client, incompleta.record.id);
    if (!lectura) {
      throw new Error("La ficha incompleta debía poder leerse.");
    }
    const faltantes = computeMissingFichaFields(lectura.content);
    expect(faltantes).toContainEqual({ field: "birthDate", kind: "sin_dato" });
    expect(faltantes).toContainEqual({ field: "ageMonths", kind: "sin_dato" });
    expect(faltantes).toContainEqual({ field: "weightKg", kind: "sin_dato" });
    expect(faltantes).toContainEqual({ field: "preexistingDiseases", kind: "sin_registrar_grupo" });
    // El hallazgo negativo explícito deja al grupo como registrado: no es «sin dato».
    expect(faltantes.some((faltante) => faltante.field === "knownAllergies")).toBe(false);
  });

  test("consulta de ficha con medicamentos y antecedentes conductuales (FR-001 · US1-AC5)", async () => {
    await addAntecedentItem(ana.client, pacienteId, "currentMedications", {
      text: "Fluoxetina 20 mg cada 24 h",
      negative: false,
    });
    await addAntecedentItem(ana.client, pacienteId, "behavioralHistory", {
      text: "Ansiedad ante tormentas",
      negative: false,
    });

    const lectura = await getPatient(ana.client, pacienteId);
    expect(lectura?.content.antecedentes.currentMedications).toEqual([
      { text: "Fluoxetina 20 mg cada 24 h", negative: false },
    ]);
    expect(lectura?.content.antecedentes.behavioralHistory).toEqual([
      { text: "Ansiedad ante tormentas", negative: false },
    ]);
  });

  test("listPatients con orden estable por created_at dentro del presupuesto (≤ 200 pacientes · ≤ 2 s)", async () => {
    const lote = Array.from({ length: 200 }, (_, indice) => ({
      clinic_id: ana.clinicId,
      record_type: "patient",
      status: "draft",
      content: { ...fichaBase(`Lote integración ${indice}`), tutorId },
    }));
    const { error } = await ana.client.from("clinical_records").insert(lote);
    expect(error).toBeNull();

    const inicio = performance.now();
    const lista = await listPatients(ana.client);
    expect(performance.now() - inicio).toBeLessThan(2000);

    expect(lista.length).toBeGreaterThanOrEqual(200);
    // Orden estable por created_at (el id desempata, igual que `compararFilas`).
    const claves = lista.map((entrada) => `${entrada.record.created_at}|${entrada.record.id}`);
    expect(claves).toEqual([...claves].sort());
  });

  test("ampliar la ficha entre consultas no altera la epicrisis efectiva (caso límite de la spec)", async () => {
    const antes = await epicrisisEfectiva(ana.client, caso.consultationId);
    expect(antes?.status).toBe("approved");

    await addAntecedentItem(ana.client, caso.patientId, "medicalHistory", {
      text: "Otitis en 2023",
      negative: false,
    });
    const lectura = await getPatient(ana.client, caso.patientId);
    if (!lectura) {
      throw new Error("La ficha del caso debía poder leerse.");
    }
    const { tutorId: tutorPrevio, ...fichaSinTutor } = lectura.content;
    await updatePatientFicha(ana.client, caso.patientId, {
      ...fichaSinTutor,
      weightKg: 13.1,
    });

    const despues = await epicrisisEfectiva(ana.client, caso.consultationId);
    expect(despues).toEqual(antes);
  });

  test("actualizar el contacto del tutor no altera la epicrisis efectiva (caso límite de la spec)", async () => {
    const antes = await epicrisisEfectiva(ana.client, caso.consultationId);

    const actualizado = await updateTutor(ana.client, caso.tutorId, {
      name: "Tutor de Caso límite integración",
      phone: "+56 9 4444 4444",
      email: null,
    });
    expect(actualizado.attribution.action).toBe("tutor_updated");

    const despues = await epicrisisEfectiva(ana.client, caso.consultationId);
    expect(despues).toEqual(antes);
  });

  // Revisión de la PR #27: dos veterinarios de la clínica editan la misma ficha (T055).
  test("guardar la ficha con una lectura previa no borra el antecedente que otro añadió entretanto", async () => {
    const bruno = await signedInVeterinarian(BRUNO);
    const alta = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: fichaBase("Kira concurrencia"),
      tutor: { existingTutorId: tutorId },
    });
    // Ana abre «Editar ficha» con esta lectura…
    const lecturaDeAna = await getPatient(ana.client, alta.record.id);
    if (!lecturaDeAna) {
      throw new Error("La ficha recién creada debía poder leerse.");
    }
    // …Bruno añade una alergia mientras tanto…
    await addAntecedentItem(bruno.client, alta.record.id, "knownAllergies", {
      text: "Penicilina",
      negative: false,
    });
    // …y Ana guarda su edición con la lectura anterior.
    const { tutorId: _tutor, ...fichaDeAna } = lecturaDeAna.content;
    await updatePatientFicha(ana.client, alta.record.id, { ...fichaDeAna, weightKg: 14 });

    const final = await getPatient(ana.client, alta.record.id);
    expect(final?.content.weightKg).toBe(14);
    expect(final?.content.antecedentes.knownAllergies).toEqual([
      { text: "Penicilina", negative: false },
    ]);
  });

  test("dos antecedentes añadidos a la vez se conservan los dos", async () => {
    const bruno = await signedInVeterinarian(BRUNO);
    const alta = await createPatientFicha(ana.client, {
      clinicId: ana.clinicId,
      ficha: fichaBase("Toby concurrencia"),
      tutor: { existingTutorId: tutorId },
    });

    await Promise.all([
      addAntecedentItem(ana.client, alta.record.id, "currentMedications", {
        text: "Fluoxetina 20 mg",
        negative: false,
      }),
      addAntecedentItem(bruno.client, alta.record.id, "currentMedications", {
        text: "Omeprazol 10 mg",
        negative: false,
      }),
    ]);

    const final = await getPatient(ana.client, alta.record.id);
    expect(
      final?.content.antecedentes.currentMedications.map((item) => item.text).sort(),
    ).toEqual(["Fluoxetina 20 mg", "Omeprazol 10 mg"]);
  });
});
