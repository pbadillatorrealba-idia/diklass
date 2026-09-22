import type { AnamnesisField, AntecedentGroup, Provenance } from "@/features/registro/schema";

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

export const ANAMNESIS_FIELD_LABELS: Record<AnamnesisField, string> = {
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

/** Orden de aparición de los campos estructurados de US2 (sin el texto libre de FR-004). */
export const ANAMNESIS_STRUCTURED_ORDER: AnamnesisField[] = [
  "motivo_consulta",
  "comportamiento_problematico",
  "frecuencia",
  "duracion",
  "contexto",
  "desencadenantes",
  "cambios_recientes",
  "ambiente",
  "convivencia",
  "alimentacion",
  "actividad",
  "rutinas",
  "tratamientos_anteriores",
  "respuesta_tratamientos",
];

export const ANAMNESIS_FIELD_OPTIONS: { value: AnamnesisField; label: string }[] =
  ANAMNESIS_STRUCTURED_ORDER.concat("texto_libre").map((value) => ({
    value,
    label: ANAMNESIS_FIELD_LABELS[value],
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
