import type {
  AnamnesisContent,
  AnamnesisField,
  AntecedentGroup,
  DiagnosisContent,
  EpicrisisContent,
  PatientContent,
} from "@/features/registro/schema";

/**
 * Ensamblaje determinista del borrador de epicrisis (D3, FR-011 · US3-AC1).
 *
 * Sin inferencia: todo sale de lo que el veterinario ya registró en la sesión y en la ficha.
 * Nada de lo que produce esta función entra al historial sin su validación explícita (FR-010),
 * y cada hallazgo conserva la procedencia que el veterinario asignó (FR-021). Los campos
 * `hipotesis` y `medicamentosAprobados` quedan vacíos: los poblán las specs 006 y 007.
 */

const ANAMNESIS_LABELS: Record<AnamnesisField, string> = {
  motivo_consulta: "Motivo de consulta",
  comportamiento_problematico: "Comportamiento problemático",
  frecuencia: "Frecuencia",
  duracion: "Duración",
  contexto: "Contexto",
  desencadenantes: "Desencadenantes",
  cambios_recientes: "Cambios recientes",
  ambiente: "Ambiente",
  convivencia: "Convivencia",
  alimentacion: "Alimentación",
  actividad: "Actividad",
  rutinas: "Rutinas",
  tratamientos_anteriores: "Tratamientos anteriores",
  respuesta_tratamientos: "Respuesta a tratamientos",
  texto_libre: "Texto libre",
};

const ANTECEDENT_LABELS: Record<AntecedentGroup, string> = {
  medicalHistory: "Antecedentes médicos",
  preexistingDiseases: "Enfermedades preexistentes",
  currentMedications: "Medicamentos actuales",
  knownAllergies: "Alergias conocidas",
  behavioralHistory: "Antecedentes conductuales",
};

const ANTECEDENT_ORDER: AntecedentGroup[] = [
  "medicalHistory",
  "preexistingDiseases",
  "currentMedications",
  "knownAllergies",
  "behavioralHistory",
];

export function buildEpicrisisDraft(input: {
  consultationId: string;
  anamnesis: AnamnesisContent[];
  diagnoses: DiagnosisContent[];
  ficha: PatientContent | null;
}): EpicrisisContent {
  const motivoConsulta = input.anamnesis
    .filter((entrada) => entrada.field === "motivo_consulta")
    .map((entrada) => entrada.text)
    .join("\n");

  const hallazgosAnamnesis = input.anamnesis
    .map(
      (entrada) =>
        `${ANAMNESIS_LABELS[entrada.field]}: ${entrada.text} [procedencia: ${entrada.provenance}]`,
    )
    .join("\n");

  const antecedentesRelevantes = input.ficha
    ? ANTECEDENT_ORDER.filter((group) => input.ficha?.antecedentes[group].length)
        .map((group) => {
          const items = (input.ficha?.antecedentes[group] ?? [])
            .map((item) => (item.negative ? `${item.text} (hallazgo negativo)` : item.text))
            .join("; ");
          return `${ANTECEDENT_LABELS[group]}: ${items}`;
        })
        .join("\n")
    : "";

  const diagnostico = input.diagnoses.map((registro) => registro.text).join("\n");

  return {
    consultationId: input.consultationId,
    motivoConsulta,
    antecedentesRelevantes,
    hallazgosAnamnesis,
    hipotesis: [],
    diagnostico,
    examenesSolicitados: [],
    intervencionesPropuestas: [],
    medicamentosAprobados: [],
    recomendacionesTutor: "",
    planSeguimiento: { pendientes: [] },
    observaciones: "",
  };
}
