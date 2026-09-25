import { z } from "zod";

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

/** Campos estructurados de US2 más el texto libre de FR-004. */
export const AnamnesisField = [
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
  "texto_libre",
] as const;

export type AnamnesisField = (typeof AnamnesisField)[number];

const provenanceSchema = z.enum(["reportada", "inferida", "recuperada", "desconocida"]);

/** Procedencia de un antecedente (FR-021 canónico, brief §7). */
export type Provenance = z.infer<typeof provenanceSchema>;

const antecedentItemSchema = z.object({
  text: z.string().trim().min(1, "Registra el texto del antecedente."),
  negative: z.boolean(),
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
});

/** Contenido de la ficha del paciente (FR-001, FR-044). */
export type PatientContent = z.infer<typeof patientContentSchema>;

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
  })
  .refine((tutor) => tutor.phone !== null || tutor.email !== null, {
    message: "Registra al menos un medio de contacto del tutor.",
  });

/** Contenido del tutor (FR-027): nombre y al menos un medio de contacto. */
export type TutorContent = z.infer<typeof tutorContentSchema>;

export const consultationContentSchema = z.object({
  patientId: requiredTextSchema,
  status: z.enum(["open", "closed"]),
});

/** Contenido de la consulta clínica (FR-003). */
export type ConsultationContent = z.infer<typeof consultationContentSchema>;

export const anamnesisContentSchema = z.object({
  consultationId: requiredTextSchema,
  field: z.enum(AnamnesisField),
  text: requiredTextSchema,
  provenance: provenanceSchema,
  provenanceHistory: z
    .array(z.object({ provenance: provenanceSchema, text: z.string().optional() }))
    .optional(),
});

/** Contenido de un antecedente de anamnesis (FR-004, FR-021). */
export type AnamnesisContent = z.infer<typeof anamnesisContentSchema>;

export const diagnosisContentSchema = z.object({
  consultationId: requiredTextSchema,
  text: requiredTextSchema,
});

/** Contenido del diagnóstico registrado por el veterinario (US3-AC1). */
export type DiagnosisContent = z.infer<typeof diagnosisContentSchema>;

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
