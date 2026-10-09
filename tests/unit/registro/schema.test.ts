import { describe, expect, test } from "bun:test";
import {
  ANAMNESIS_SECTIONS,
  AnamnesisField,
  anamnesisContentSchema,
  consultationContentSchema,
  diagnosisContentSchema,
  epicrisisContentSchema,
  LEGACY_ANAMNESIS_FIELDS,
  patientContentSchema,
  tutorContentSchema,
} from "@/features/registro/schema";

const fichaBase = {
  name: "Luna",
  species: "perro",
  breed: "Mestizo",
  sex: "hembra",
  reproductiveStatus: "esterilizada",
  tutorId: "tutor-1",
};

const anamnesisBase = {
  consultationId: "consulta-1",
  text: "Aúlla cuando queda sola.",
  provenance: "reportada",
};

describe("patientContentSchema (FR-001, FR-044)", () => {
  test("acepta la ficha mínima y marca los opcionales como sin dato, sin valores por omisión", () => {
    const ficha = patientContentSchema.parse(fichaBase);

    expect(ficha.birthDate).toBeNull();
    expect(ficha.ageMonths).toBeNull();
    expect(ficha.weightKg).toBeNull();
    expect(ficha.antecedentes).toEqual({
      medicalHistory: [],
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [],
      behavioralHistory: [],
    });
  });

  test("acepta null explícito igual que la ausencia de los campos opcionales (FR-044)", () => {
    const ficha = patientContentSchema.parse({
      ...fichaBase,
      birthDate: null,
      ageMonths: null,
      weightKg: null,
    });

    expect(ficha.birthDate).toBeNull();
    expect(ficha.ageMonths).toBeNull();
    expect(ficha.weightKg).toBeNull();
  });

  test("conserva íntegros los datos registrados, incluidos los hallazgos negativos (FR-044)", () => {
    const ficha = patientContentSchema.parse({
      ...fichaBase,
      birthDate: "2021-05-01",
      ageMonths: 24,
      weightKg: 12.4,
      antecedentes: {
        medicalHistory: [{ text: "Displasia de cadera", negative: false }],
        knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
      },
    });

    expect(ficha.birthDate).toBe("2021-05-01");
    expect(ficha.weightKg).toBe(12.4);
    expect(ficha.antecedentes.knownAllergies).toEqual([
      { text: "Sin alergias conocidas", negative: true },
    ]);
    expect(ficha.antecedentes.medicalHistory).toEqual([
      { text: "Displasia de cadera", negative: false },
    ]);
  });

  test("rechaza pesos y edades negativos y peso cero", () => {
    expect(patientContentSchema.safeParse({ ...fichaBase, weightKg: -1 }).success).toBe(false);
    expect(patientContentSchema.safeParse({ ...fichaBase, weightKg: 0 }).success).toBe(false);
    expect(patientContentSchema.safeParse({ ...fichaBase, ageMonths: -2 }).success).toBe(false);
  });

  test("rechaza tipos incorrectos en los campos numéricos", () => {
    expect(patientContentSchema.safeParse({ ...fichaBase, weightKg: "12" }).success).toBe(false);
    expect(patientContentSchema.safeParse({ ...fichaBase, ageMonths: "24" }).success).toBe(false);
  });

  test("solo acepta fechas ISO (AAAA-MM-DD) para la fecha de nacimiento", () => {
    const iso = patientContentSchema.safeParse({ ...fichaBase, birthDate: "2021-05-01" });
    const latina = patientContentSchema.safeParse({ ...fichaBase, birthDate: "01/05/2021" });
    const fueraDeCalendario = patientContentSchema.safeParse({
      ...fichaBase,
      birthDate: "2021-02-30",
    });

    expect(iso.success).toBe(true);
    expect(latina.success).toBe(false);
    expect(fueraDeCalendario.success).toBe(false);
  });

  test("rechaza campos obligatorios vacíos o ausentes", () => {
    expect(patientContentSchema.safeParse({ ...fichaBase, name: "   " }).success).toBe(false);
    expect(patientContentSchema.safeParse({ ...fichaBase, tutorId: "" }).success).toBe(false);
    const { name: _omitido, ...sinNombre } = fichaBase;
    expect(patientContentSchema.safeParse(sinNombre).success).toBe(false);
  });
});

describe("tutorContentSchema (FR-027)", () => {
  test("exige al menos un medio de contacto no vacío", () => {
    expect(tutorContentSchema.safeParse({ name: "María" }).success).toBe(false);
    expect(tutorContentSchema.safeParse({ name: "María", phone: null, email: null }).success).toBe(
      false,
    );
    expect(tutorContentSchema.safeParse({ name: "María", phone: "   " }).success).toBe(false);
    expect(tutorContentSchema.safeParse({ name: "María", phone: "555-0101" }).success).toBe(true);
    expect(
      tutorContentSchema.safeParse({ name: "María", email: "maria@example.test" }).success,
    ).toBe(true);
  });

  test("acepta ambos medios y normaliza los vacíos a sin dato", () => {
    const tutor = tutorContentSchema.parse({ name: "María", phone: " 555-0101 ", email: "" });

    expect(tutor.phone).toBe("555-0101");
    expect(tutor.email).toBeNull();
  });

  test("rechaza un tutor sin nombre", () => {
    expect(tutorContentSchema.safeParse({ name: "", phone: "555-0101" }).success).toBe(false);
  });
});

describe("anamnesisContentSchema (FR-021, US2)", () => {
  test("el vocabulario AnamnesisField es el catálogo de la hoja, los campos previos y texto_libre", () => {
    const catalogo = ANAMNESIS_SECTIONS.flatMap((section) => section.fields.map((f) => f.id));

    expect([...AnamnesisField]).toEqual([...catalogo, ...LEGACY_ANAMNESIS_FIELDS, "texto_libre"]);
    expect(new Set(AnamnesisField).size).toBe(AnamnesisField.length);
    expect(catalogo).toContain("motivo_consulta");
    expect(LEGACY_ANAMNESIS_FIELDS).toContain("desencadenantes");
    expect(catalogo).not.toContain("desencadenantes");
  });

  test("las preguntas cerradas solo admiten sus valores (FR-111)", () => {
    const tri = anamnesisContentSchema.safeParse({
      ...anamnesisBase,
      field: "soledad_vocaliza",
      text: "a_veces",
    });
    const triInvalida = anamnesisContentSchema.safeParse({
      ...anamnesisBase,
      field: "soledad_vocaliza",
      text: "quizás",
    });
    const sinoConAVeces = anamnesisContentSchema.safeParse({
      ...anamnesisBase,
      field: "familia_agresion",
      text: "a_veces",
    });
    const sino = anamnesisContentSchema.safeParse({
      ...anamnesisBase,
      field: "familia_agresion",
      text: "no",
    });

    expect(tri.success).toBe(true);
    expect(triInvalida.success).toBe(false);
    expect(sinoConAVeces.success).toBe(false);
    expect(sino.success).toBe(true);
  });

  test("rechaza un campo fuera del vocabulario estructurado", () => {
    const conTextoLibre = anamnesisContentSchema.safeParse({
      ...anamnesisBase,
      field: "texto_libre",
    });
    const conCambios = anamnesisContentSchema.safeParse({
      ...anamnesisBase,
      field: "cambios_recientes",
    });
    const conErrata = anamnesisContentSchema.safeParse({
      ...anamnesisBase,
      field: "cambies_recientes",
    });
    const desconocido = anamnesisContentSchema.safeParse({ ...anamnesisBase, field: "otro" });

    expect(conTextoLibre.success).toBe(true);
    expect(conCambios.success).toBe(true);
    expect(conErrata.success).toBe(false);
    expect(desconocido.success).toBe(false);
  });

  test("registra la procedencia y la conserva en el historial de correcciones (FR-021)", () => {
    const entrada = anamnesisContentSchema.parse({
      ...anamnesisBase,
      field: "frecuencia",
      provenance: "inferida",
      provenanceHistory: [{ provenance: "desconocida", text: "Fluoxetina en 2024." }],
    });

    expect(entrada.provenance).toBe("inferida");
    // El `text` de la historia se preserva: Zod no debe recortar lo ya almacenado (FR-021).
    expect(entrada.provenanceHistory).toEqual([
      { provenance: "desconocida", text: "Fluoxetina en 2024." },
    ]);
  });

  test("acepta el vocabulario canónico de procedencia y rechaza lo demás", () => {
    for (const provenance of ["reportada", "inferida", "recuperada", "desconocida"]) {
      expect(
        anamnesisContentSchema.safeParse({ ...anamnesisBase, field: "frecuencia", provenance })
          .success,
      ).toBe(true);
    }
    expect(
      anamnesisContentSchema.safeParse({
        ...anamnesisBase,
        field: "frecuencia",
        provenance: "confirmada",
      }).success,
    ).toBe(false);
  });

  test("acepta la procedencia recuperada de una fuente (FR-021 canónico)", () => {
    const entrada = anamnesisContentSchema.parse({
      ...anamnesisBase,
      field: "tratamientos_anteriores",
      provenance: "recuperada",
    });

    expect(entrada.provenance).toBe("recuperada");
  });

  test("rechaza un antecedente sin texto", () => {
    expect(
      anamnesisContentSchema.safeParse({
        ...anamnesisBase,
        field: "frecuencia",
        text: "  ",
        provenance: "reportada",
      }).success,
    ).toBe(false);
  });
});

describe("consultationContentSchema y diagnosisContentSchema", () => {
  test("la consulta solo admite estado abierta o cerrada", () => {
    expect(
      consultationContentSchema.safeParse({ patientId: "paciente-1", status: "open" }).success,
    ).toBe(true);
    expect(
      consultationContentSchema.safeParse({ patientId: "paciente-1", status: "closed" }).success,
    ).toBe(true);
    expect(
      consultationContentSchema.safeParse({ patientId: "paciente-1", status: "paused" }).success,
    ).toBe(false);
  });

  test("el diagnóstico exige texto y consulta asociada", () => {
    expect(
      diagnosisContentSchema.safeParse({ consultationId: "consulta-1", text: "Ansiedad" }).success,
    ).toBe(true);
    expect(
      diagnosisContentSchema.safeParse({ consultationId: "consulta-1", text: "" }).success,
    ).toBe(false);
    expect(diagnosisContentSchema.safeParse({ text: "Ansiedad" }).success).toBe(false);
  });
});

describe("epicrisisContentSchema (FR-011)", () => {
  const epicrisisBase = {
    consultationId: "consulta-1",
    motivoConsulta: "Aúlla cuando queda sola.",
    antecedentesRelevantes: "Alergias conocidas: Sin alergias conocidas (hallazgo negativo)",
    hallazgosAnamnesis: "Frecuencia: a diario [procedencia: reportada]",
    hipotesis: [{ texto: "Ansiedad por separación", estado: "considerada" }],
    diagnostico: "Ansiedad por separación",
    examenesSolicitados: ["Hemograma"],
    intervencionesPropuestas: ["Modificación de conducta"],
    medicamentosAprobados: ["Fluoxetina 20 mg"],
    recomendacionesTutor: "Evitar despedidas prolongadas.",
    planSeguimiento: { pendientes: ["Control en 30 días"] },
    observaciones: "Tutor muy colaborador.",
  };

  test("acepta la epicrisis completa con los campos de 006/007 vacíos", () => {
    const epicrisis = epicrisisContentSchema.parse({
      ...epicrisisBase,
      hipotesis: [],
      medicamentosAprobados: [],
    });

    expect(epicrisis.hipotesis).toEqual([]);
    expect(epicrisis.medicamentosAprobados).toEqual([]);
  });

  test("rechaza una epicrisis incompleta: sin plan de seguimiento o sin diagnóstico", () => {
    const { planSeguimiento: _sinPlan, ...sinPlan } = epicrisisBase;
    expect(epicrisisContentSchema.safeParse(sinPlan).success).toBe(false);
    const { diagnostico: _sinDiagnostico, ...sinDiagnostico } = epicrisisBase;
    expect(epicrisisContentSchema.safeParse(sinDiagnostico).success).toBe(false);
  });
});

describe("ampliación etológica de la ficha (FR-001, FR-027, FR-110)", () => {
  test("los datos de procedencia y adopción son opcionales y quedan sin dato", () => {
    const ficha = patientContentSchema.parse(fichaBase);

    expect(ficha.fileNumber).toBeNull();
    expect(ficha.firstVisitDate).toBeNull();
    expect(ficha.origin).toBeNull();
    expect(ficha.adoptionAge).toBeNull();
    expect(ficha.adoptionState).toBeNull();
    expect(ficha.neuterAge).toBeNull();
    expect(ficha.litterInfo).toBeNull();
    expect(ficha.referrer).toBeNull();
  });

  test("conserva procedencia, adopción y derivante", () => {
    const ficha = patientContentSchema.parse({
      ...fichaBase,
      origin: " Protectora ",
      adoptionAge: "3 meses",
      firstVisitDate: "2026-09-01",
      referrer: { refers: "si", center: "Clínica Norte", opinion: "Ansiedad" },
    });

    expect(ficha.origin).toBe("Protectora");
    expect(ficha.adoptionAge).toBe("3 meses");
    expect(ficha.referrer).toEqual({
      refers: "si",
      name: null,
      center: "Clínica Norte",
      phone: null,
      insurance: null,
      opinion: "Ansiedad",
    });
    expect(
      patientContentSchema.safeParse({ ...fichaBase, firstVisitDate: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      patientContentSchema.safeParse({ ...fichaBase, referrer: { refers: "tal vez" } }).success,
    ).toBe(false);
  });

  test("el tutor admite apellidos y dirección sin exigirlos, y sigue exigiendo contacto", () => {
    const tutor = tutorContentSchema.parse({
      name: "María",
      phone: "555-0101",
      surname: "Pérez",
      address: "Calle 1",
      city: "Barcelona",
      postalCode: "08001",
    });

    expect(tutor.surname).toBe("Pérez");
    expect(tutor.postalCode).toBe("08001");
    expect(tutorContentSchema.parse({ name: "María", phone: "1" }).address).toBeNull();
    expect(tutorContentSchema.safeParse({ name: "María", surname: "Pérez" }).success).toBe(false);
  });
});

describe("plan de la consulta (FR-112)", () => {
  const diagnosis = { consultationId: "consulta-1", text: "Ansiedad por separación" };

  test("el plan es opcional y el diagnóstico presuntivo sigue siendo el texto", () => {
    expect(diagnosisContentSchema.parse(diagnosis).plan).toBeNull();
  });

  test("acepta protocolo, hasta tres diferenciales y hasta dos principios activos", () => {
    const ok = diagnosisContentSchema.safeParse({
      ...diagnosis,
      plan: {
        tests: ["analisis_sangre", "radiografia"],
        differentials: ["Fobia", "Hiperapego"],
        medication: [{ activeIngredient: "Fluoxetina", guideline: "1 mg/kg/24h" }],
        neuterSurgical: "no",
      },
    });
    const cuatro = diagnosisContentSchema.safeParse({
      ...diagnosis,
      plan: { differentials: ["a", "b", "c", "d"] },
    });
    const tres = diagnosisContentSchema.safeParse({
      ...diagnosis,
      plan: {
        medication: [
          { activeIngredient: "a", guideline: "x" },
          { activeIngredient: "b", guideline: "x" },
          { activeIngredient: "c", guideline: "x" },
        ],
      },
    });
    const prueba = diagnosisContentSchema.safeParse({ ...diagnosis, plan: { tests: ["magia"] } });

    expect(ok.success).toBe(true);
    expect(cuatro.success).toBe(false);
    expect(tres.success).toBe(false);
    expect(prueba.success).toBe(false);
  });
});
