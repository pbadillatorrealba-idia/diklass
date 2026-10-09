import {
  answerText,
  DIAGNOSTIC_TEST_LABELS,
  fieldLabel,
} from "@/features/registro/anamnesis-catalog";
import type {
  AnamnesisContent,
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
        `${fieldLabel(entrada.field)}: ${answerText(entrada.field, entrada.text)} [procedencia: ${entrada.provenance}]`,
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

  // FR-112: el plan es propuesta del veterinario; entra tal cual lo escribió. Las hipótesis y los
  // medicamentos aprobados siguen reservados a 006 y 007 (FR-010).
  const planes = input.diagnoses.flatMap((registro) => (registro.plan ? [registro.plan] : []));
  const examenesSolicitados = planes.flatMap((plan) => [
    ...(plan.tests ?? []).map((prueba) => DIAGNOSTIC_TEST_LABELS[prueba]),
    ...(plan.otherTests ? [plan.otherTests] : []),
  ]);
  const intervencionesPropuestas = planes.flatMap((plan) => [
    ...[plan.generalGuidelines, plan.specificGuidelines, plan.complementaryGuidelines].filter(
      (pauta): pauta is string => Boolean(pauta),
    ),
    ...(plan.medication ?? []).map(
      (m) => `Medicación propuesta: ${m.activeIngredient} — ${m.guideline}`,
    ),
  ]);
  const diferenciales = planes.flatMap((plan) => plan.differentials ?? []);
  const pendientes = planes.flatMap((plan) => (plan.followUp ? [plan.followUp] : []));

  return {
    consultationId: input.consultationId,
    motivoConsulta,
    antecedentesRelevantes,
    hallazgosAnamnesis,
    hipotesis: [],
    diagnostico,
    examenesSolicitados,
    intervencionesPropuestas,
    medicamentosAprobados: [],
    recomendacionesTutor: "",
    planSeguimiento: { pendientes },
    observaciones: diferenciales.length
      ? `Diagnósticos diferenciales (veterinario): ${diferenciales.join("; ")}`
      : "",
  };
}
