import { fieldLabel, isLegacyAnamnesisField } from "@/features/registro/anamnesis-catalog";
import {
  ANAMNESIS_SECTIONS,
  type AnamnesisField,
  type AntecedentGroup,
  type EpicrisisContent,
  type Provenance,
} from "@/features/registro/schema";

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

/** Orden de aparición de los campos estructurados de la hoja (sin el texto libre de FR-004). */
export const ANAMNESIS_STRUCTURED_ORDER: AnamnesisField[] = ANAMNESIS_SECTIONS.flatMap((section) =>
  section.fields.map((f) => f.id),
);

export const ANAMNESIS_FIELD_OPTIONS: { value: AnamnesisField; label: string }[] =
  ANAMNESIS_STRUCTURED_ORDER.concat("texto_libre").map((value) => ({
    value,
    label: fieldLabel(value),
  }));

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
