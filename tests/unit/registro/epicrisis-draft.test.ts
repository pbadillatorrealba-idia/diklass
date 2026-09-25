import { describe, expect, test } from "bun:test";
import { buildEpicrisisDraft } from "@/features/registro/epicrisis-draft";
import type {
  AnamnesisContent,
  DiagnosisContent,
  PatientContent,
} from "@/features/registro/schema";

function entrada(
  field: AnamnesisContent["field"],
  text: string,
  provenance: AnamnesisContent["provenance"] = "reportada",
): AnamnesisContent {
  return { consultationId: "c-1", field, text, provenance };
}

function diagnostico(text: string): DiagnosisContent {
  return { consultationId: "c-1", text };
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
      preexistingDiseases: [],
      currentMedications: [],
      knownAllergies: [{ text: "Sin alergias conocidas", negative: true }],
      behavioralHistory: [],
    },
    tutorId: "tutor-1",
    ...cambios,
  };
}

describe("buildEpicrisisDraft (FR-010, FR-011, FR-021 · US3-AC1)", () => {
  test("ensambla todos los campos de FR-011 con lo registrado en la sesión (US3-AC1)", () => {
    const borrador = buildEpicrisisDraft({
      consultationId: "c-1",
      anamnesis: [
        entrada("motivo_consulta", "Aúlla cuando queda sola."),
        entrada("frecuencia", "A diario", "inferida"),
        entrada("tratamientos_anteriores", "Fluoxetina en 2024", "recuperada"),
        entrada("texto_libre", "Mudanza reciente", "desconocida"),
      ],
      diagnoses: [diagnostico("Ansiedad por separación")],
      ficha: ficha(),
    });

    expect(borrador.consultationId).toBe("c-1");
    expect(borrador.motivoConsulta).toBe("Aúlla cuando queda sola.");
    expect(borrador.diagnostico).toBe("Ansiedad por separación");
    expect(borrador.antecedentesRelevantes).toBe(
      "Antecedentes médicos: Displasia de cadera\n" +
        "Alergias conocidas: Sin alergias conocidas (hallazgo negativo)",
    );
    expect(borrador.hallazgosAnamnesis).toBe(
      "Motivo de consulta: Aúlla cuando queda sola. [procedencia: reportada]\n" +
        "Frecuencia: A diario [procedencia: inferida]\n" +
        "Tratamientos anteriores: Fluoxetina en 2024 [procedencia: recuperada]\n" +
        "Texto libre: Mudanza reciente [procedencia: desconocida]",
    );
  });

  test("reserva vacíos los campos que poblán 006 y 007 y el resto editable (FR-011)", () => {
    const borrador = buildEpicrisisDraft({
      consultationId: "c-1",
      anamnesis: [],
      diagnoses: [],
      ficha: null,
    });

    expect(borrador).toEqual({
      consultationId: "c-1",
      motivoConsulta: "",
      antecedentesRelevantes: "",
      hallazgosAnamnesis: "",
      hipotesis: [],
      diagnostico: "",
      examenesSolicitados: [],
      intervencionesPropuestas: [],
      medicamentosAprobados: [],
      recomendacionesTutor: "",
      planSeguimiento: { pendientes: [] },
      observaciones: "",
    });
  });

  test("el motivo de consulta concatena solo las entradas de motivo_consulta", () => {
    const borrador = buildEpicrisisDraft({
      consultationId: "c-1",
      anamnesis: [
        entrada("motivo_consulta", "No duerme."),
        entrada("frecuencia", "Todas las noches"),
        entrada("motivo_consulta", "Ladra de noche."),
      ],
      diagnoses: [],
      ficha: null,
    });

    expect(borrador.motivoConsulta).toBe("No duerme.\nLadra de noche.");
  });

  test("marca los hallazgos negativos y omite los grupos de antecedentes vacíos (FR-044)", () => {
    const borrador = buildEpicrisisDraft({
      consultationId: "c-1",
      anamnesis: [],
      diagnoses: [],
      ficha: ficha(),
    });

    expect(borrador.antecedentesRelevantes).toBe(
      "Antecedentes médicos: Displasia de cadera\n" +
        "Alergias conocidas: Sin alergias conocidas (hallazgo negativo)",
    );
  });

  test("concatena los diagnósticos del veterinario en orden de registro", () => {
    const borrador = buildEpicrisisDraft({
      consultationId: "c-1",
      anamnesis: [],
      diagnoses: [diagnostico("Ansiedad por separación"), diagnostico("Fobia a ruidos")],
      ficha: null,
    });

    expect(borrador.diagnostico).toBe("Ansiedad por separación\nFobia a ruidos");
  });

  test("es determinista: la misma entrada produce siempre el mismo borrador", () => {
    const entradaArgs = {
      consultationId: "c-1",
      anamnesis: [entrada("frecuencia", "A diario", "inferida")],
      diagnoses: [diagnostico("Ansiedad")],
      ficha: ficha(),
    };

    expect(buildEpicrisisDraft(entradaArgs)).toEqual(buildEpicrisisDraft(entradaArgs));
  });

  test("ensambla dentro del presupuesto de 300 ms con una sesión grande (design.md)", () => {
    const anamnesis: AnamnesisContent[] = Array.from({ length: 300 }, (_, indice) =>
      entrada("frecuencia", `Entrada número ${indice}`, "reportada"),
    );
    const diagnoses: DiagnosisContent[] = Array.from({ length: 200 }, (_, indice) =>
      diagnostico(`Diagnóstico ${indice}`),
    );

    const inicio = performance.now();
    const borrador = buildEpicrisisDraft({
      consultationId: "c-1",
      anamnesis,
      diagnoses,
      ficha: ficha(),
    });
    const transcurrido = performance.now() - inicio;

    expect(transcurrido).toBeLessThan(300);
    expect(borrador.diagnostico.split("\n")).toHaveLength(200);
  });
});
