import { z } from "zod";
import {
  ANAMNESIS_SECTIONS,
  type CatalogField,
  isValidAnswer,
  LEGACY_ANAMNESIS_FIELDS,
} from "@/features/registro/anamnesis-catalog";

/**
 * Forma del contenido por entidad clínica (D2 del diseño del cambio).
 *
 * Reglas aplicadas en esta frontera:
 * - Los campos opcionales de FR-001 aceptan `null` o ausentes y se normalizan a «sin dato»
 *   (`null`, o lista vacía para los grupos de antecedentes): nunca se inventa un valor por
 *   omisión (FR-044).
 * - Un ítem de antecedente con `negative: true` es un hallazgo negativo explícitamente
 *   registrado; una lista vacía es un grupo sin registrar (FR-044).
 * - Las fechas son strings ISO (`AAAA-MM-DD`).
 * - Toda entrada se valida con Zod; los textos obligatorios viajan recortados y no vacíos.
 */

type AnamnesisFieldId =
  | CatalogField["id"]
  | (typeof LEGACY_ANAMNESIS_FIELDS)[number]
  | "texto_libre";

/**
 * Campos de anamnesis: el catálogo de la hoja etológica, los campos previos (solo lectura, D4)
 * y el texto libre de FR-004.
 */
export const AnamnesisField = [
  ...ANAMNESIS_SECTIONS.flatMap((section) => section.fields.map((field) => field.id)),
  ...LEGACY_ANAMNESIS_FIELDS,
  "texto_libre",
] as unknown as readonly [AnamnesisFieldId, ...AnamnesisFieldId[]];

export { ANAMNESIS_SECTIONS, LEGACY_ANAMNESIS_FIELDS };

export type AnamnesisField = (typeof AnamnesisField)[number];

const provenanceSchema = z.enum(["reportada", "inferida", "recuperada", "desconocida"]);

/** Procedencia de un antecedente (FR-021 canónico, brief §7). */
export type Provenance = z.infer<typeof provenanceSchema>;

const antecedentItemSchema = z.object({
  text: z.string().trim().min(1, "Registra el texto del antecedente."),
  negative: z.boolean(),
  /** Instante del alta (ISO); los ítems anteriores a este campo no lo tienen. */
  recordedAt: z.string().optional(),
});

/** Ítem de antecedente: `negative: true` es un hallazgo negativo registrado (FR-044). */
export type AntecedentItem = z.infer<typeof antecedentItemSchema>;

/** Grupos de antecedentes de la ficha (FR-001). */
export type AntecedentGroup =
  | "medicalHistory"
  | "preexistingDiseases"
  | "currentMedications"
  | "knownAllergies"
  | "behavioralHistory";

/** Los campos añadidos por la hoja etológica son opcionales al construir el tipo (parse → `null`). */
type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

const requiredTextSchema = z.string().trim().min(1, "Este campo es obligatorio.");

const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Registra la fecha en formato ISO (AAAA-MM-DD).")
  .refine((value) => {
    // Date.parse acepta fechas fuera de calendario (p. ej. 2021-02-30) y las hace rodar;
    // solo vale una fecha que vuelva idéntica desde su representación ISO.
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Registra una fecha válida.");

const antecedentListSchema = z
  .array(antecedentItemSchema)
  .nullish()
  .transform((items) => items ?? []);

const antecedentesSchema = z
  .object({
    medicalHistory: antecedentListSchema,
    preexistingDiseases: antecedentListSchema,
    currentMedications: antecedentListSchema,
    knownAllergies: antecedentListSchema,
    behavioralHistory: antecedentListSchema,
  })
  .nullish()
  .transform(
    (antecedentes) =>
      antecedentes ?? {
        medicalHistory: [],
        preexistingDiseases: [],
        currentMedications: [],
        knownAllergies: [],
        behavioralHistory: [],
      },
  );

const optionalTextSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null));

const referrerSchema = z
  .object({
    refers: z
      .enum(["si", "no"])
      .nullish()
      .transform((value) => value ?? null),
    name: optionalTextSchema,
    center: optionalTextSchema,
    phone: optionalTextSchema,
    insurance: optionalTextSchema,
    opinion: optionalTextSchema,
  })
  .nullish()
  .transform((value) => value ?? null);

export const patientContentSchema = z.object({
  name: requiredTextSchema,
  species: requiredTextSchema,
  breed: requiredTextSchema,
  birthDate: isoDateSchema.nullish().transform((value) => value ?? null),
  ageMonths: z
    .number()
    .nonnegative("La edad no puede ser negativa.")
    .nullish()
    .transform((value) => value ?? null),
  weightKg: z
    .number()
    .positive("El peso registrado debe ser positivo.")
    .nullish()
    .transform((value) => value ?? null),
  sex: requiredTextSchema,
  reproductiveStatus: requiredTextSchema,
  antecedentes: antecedentesSchema,
  tutorId: requiredTextSchema,
  // Hoja de etología clínica (FR-001 ampliado, FR-110): todo opcional, sin dato = null.
  fileNumber: optionalTextSchema,
  firstVisitDate: isoDateSchema.nullish().transform((value) => value ?? null),
  origin: optionalTextSchema,
  adoptionAge: optionalTextSchema,
  adoptionState: optionalTextSchema,
  neuterAge: optionalTextSchema,
  litterInfo: optionalTextSchema,
  referrer: referrerSchema,
});

/** Contenido de la ficha del paciente (FR-001, FR-044). */
export type PatientContent = WithOptional<
  z.infer<typeof patientContentSchema>,
  | "fileNumber"
  | "firstVisitDate"
  | "origin"
  | "adoptionAge"
  | "adoptionState"
  | "neuterAge"
  | "litterInfo"
  | "referrer"
>;

const contactSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null));

export const tutorContentSchema = z
  .object({
    name: requiredTextSchema,
    phone: contactSchema,
    email: contactSchema,
    surname: optionalTextSchema,
    address: optionalTextSchema,
    city: optionalTextSchema,
    postalCode: optionalTextSchema,
  })
  .refine((tutor) => tutor.phone !== null || tutor.email !== null, {
    message: "Registra al menos un medio de contacto del tutor.",
  });

/** Contenido del tutor (FR-027): nombre y al menos un medio de contacto. */
export type TutorContent = WithOptional<
  z.infer<typeof tutorContentSchema>,
  "surname" | "address" | "city" | "postalCode"
>;

export const consultationContentSchema = z.object({
  patientId: requiredTextSchema,
  status: z.enum(["open", "closed"]),
});

/** Contenido de la consulta clínica (FR-003). */
export type ConsultationContent = z.infer<typeof consultationContentSchema>;

export const anamnesisContentSchema = z
  .object({
    consultationId: requiredTextSchema,
    field: z.enum(AnamnesisField),
    text: requiredTextSchema,
    provenance: provenanceSchema,
    provenanceHistory: z
      .array(z.object({ provenance: provenanceSchema, text: z.string().optional() }))
      .optional(),
  })
  .refine((entry) => isValidAnswer(entry.field, entry.text), {
    path: ["text"],
    message: "Elige una de las respuestas.",
  });

/** Contenido de un antecedente de anamnesis (FR-004, FR-021). */
export type AnamnesisContent = z.infer<typeof anamnesisContentSchema>;

export const DIAGNOSTIC_TESTS = [
  "exploracion_fisica",
  "exploracion_neurologica",
  "analisis_sangre",
  "urianalisis",
  "coprologico",
  "ecografia",
  "radiografia",
  "resonancia",
] as const;

const yesNoSchema = z
  .enum(["si", "no"])
  .nullish()
  .transform((value) => value ?? null);

/**
 * Plan de la consulta de la hoja etológica (FR-112): lo escribe el veterinario; el sistema no
 * propone ni completa nada. Los límites son los renglones de la hoja (3 diferenciales, 2
 * principios activos).
 */
const consultationPlanSchema = z
  .object({
    tests: z
      .array(z.enum(DIAGNOSTIC_TESTS))
      .nullish()
      .transform((v) => v ?? []),
    otherTests: optionalTextSchema,
    video: yesNoSchema,
    videoDetails: optionalTextSchema,
    differentials: z
      .array(requiredTextSchema)
      .max(3, "Máximo tres diferenciales.")
      .nullish()
      .transform((v) => v ?? []),
    generalGuidelines: optionalTextSchema,
    specificGuidelines: optionalTextSchema,
    complementaryGuidelines: optionalTextSchema,
    neuterSurgical: yesNoSchema,
    neuterMedical: yesNoSchema,
    medication: z
      .array(z.object({ activeIngredient: requiredTextSchema, guideline: requiredTextSchema }))
      .max(2, "Máximo dos principios activos.")
      .nullish()
      .transform((v) => v ?? []),
    followUp: optionalTextSchema,
  })
  .nullish()
  .transform((value) => value ?? null);

/** Entrada del plan: los campos que el veterinario no completó pueden omitirse. */
export type ConsultationPlanInput = z.input<typeof consultationPlanSchema>;

export const diagnosisContentSchema = z.object({
  consultationId: requiredTextSchema,
  text: requiredTextSchema,
  plan: consultationPlanSchema,
});

/** Contenido del diagnóstico registrado por el veterinario (US3-AC1). */
export type DiagnosisContent = WithOptional<z.infer<typeof diagnosisContentSchema>, "plan">;

export const epicrisisContentSchema = z.object({
  consultationId: requiredTextSchema,
  motivoConsulta: z.string(),
  antecedentesRelevantes: z.string(),
  hallazgosAnamnesis: z.string(),
  hipotesis: z.array(z.object({ texto: z.string(), estado: z.string() })),
  diagnostico: z.string(),
  examenesSolicitados: z.array(z.string()),
  intervencionesPropuestas: z.array(z.string()),
  medicamentosAprobados: z.array(z.string()),
  recomendacionesTutor: z.string(),
  planSeguimiento: z.object({ pendientes: z.array(z.string()) }),
  observaciones: z.string(),
});

/**
 * Contenido de la epicrisis (FR-011). `hipotesis` y `medicamentosAprobados` quedan vacíos en
 * esta spec: los poblán las specs 006 y 007.
 */
export type EpicrisisContent = z.infer<typeof epicrisisContentSchema>;
