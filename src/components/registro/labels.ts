import { isLegacyAnamnesisField } from "@/features/registro/anamnesis-catalog";
import type { AntecedentGroup, EpicrisisContent, Provenance } from "@/features/registro/schema";

/**
 * Etiquetas de interfaz del registro clínico. Vocabulario visible en español; los valores
 * que viajan al contenido siguen siendo los identificadores canónicos del modelo (D2).
 */

export const ANTECEDENT_GROUP_LABELS: Record<AntecedentGroup, string> = {
  medicalHistory: "Antecedentes médicos",
  preexistingDiseases: "Enfermedades preexistentes",
  currentMedications: "Medicamentos actuales",
  knownAllergies: "Alergias conocidas",
  behavioralHistory: "Antecedentes conductuales",
};

export const ANTECEDENT_GROUP_ORDER: AntecedentGroup[] = [
  "medicalHistory",
  "preexistingDiseases",
  "currentMedications",
  "knownAllergies",
  "behavioralHistory",
];

export { isLegacyAnamnesisField };

export const PROVENANCE_LABELS: Record<Provenance, string> = {
  reportada: "Reportada",
  inferida: "Inferida",
  recuperada: "Recuperada",
  desconocida: "Desconocida",
};

export const PROVENANCE_OPTIONS: { value: Provenance; label: string }[] = (
  ["reportada", "inferida", "recuperada", "desconocida"] as Provenance[]
).map((value) => ({ value, label: PROVENANCE_LABELS[value] }));

/** Etiquetas de los campos de FR-001 que `computeMissingFichaFields` señala como faltantes. */
export const MISSING_FIELD_LABELS: Record<string, string> = {
  birthDate: "Fecha de nacimiento",
  ageMonths: "Edad (meses)",
  weightKg: "Peso (kg)",
  origin: "Procedencia",
  adoptionAge: "Edad con que fue adoptado",
  ...ANTECEDENT_GROUP_LABELS,
};

/**
 * Rótulos de lectura de los campos de la epicrisis (FR-011), en el orden del formulario. Los de
 * edición (`epicrisis-fields.tsx`) añaden la indicación «uno por línea».
 */
export const EPICRISIS_FIELD_LABELS = {
  motivoConsulta: "Motivo de consulta",
  antecedentesRelevantes: "Antecedentes relevantes",
  hallazgosAnamnesis: "Hallazgos de la anamnesis",
  hipotesis: "Hipótesis consideradas",
  diagnostico: "Diagnóstico registrado",
  examenesSolicitados: "Exámenes solicitados",
  intervencionesPropuestas: "Intervenciones propuestas",
  medicamentosAprobados: "Medicamentos aprobados",
  recomendacionesTutor: "Recomendaciones al tutor",
  planSeguimiento: "Pendientes del plan de seguimiento",
  observaciones: "Observaciones",
} as const satisfies Record<Exclude<keyof EpicrisisContent, "consultationId">, string>;
