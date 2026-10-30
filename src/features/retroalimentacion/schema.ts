import { z } from "zod";

/**
 * Forma del contenido de la retroalimentación clínica (D2 del diseño del cambio):
 * los siete contenidos de FR-018 con campo propio sobre `record_type = 'clinical_feedback'`.
 */

/** Adherencia al plan de seguimiento (FR-040 · US10-AC8): nunca una respuesta binaria. */
export const Adherence = ["completa", "parcial", "ninguna", "desconocida"] as const;

export type Adherence = (typeof Adherence)[number];

/**
 * Evolución observada (FR-018, FR-040): incluye mejoría y ausencia de cambios, y admite
 * `mejoriaParcial` y `desconocida` para no forzar precisión falsa.
 */
export const Evolution = [
  "mejoria",
  "mejoriaParcial",
  "sinCambios",
  "empeoramiento",
  "desconocida",
] as const;

export type Evolution = (typeof Evolution)[number];

/** Severidad del evento adverso (FR-041): el `grave` es diferenciable sin interpretar texto. */
export const AdverseEventSeverity = ["leve", "moderado", "grave"] as const;

export type AdverseEventSeverity = (typeof AdverseEventSeverity)[number];

const requiredTextSchema = z.string().trim().min(1, "Este campo es obligatorio.");

/**
 * Texto opcional: ausente, vacío o en blanco se normaliza a `null` — un string vacío no es
 * información, es ausencia de ella (mismo criterio que el contacto del tutor en 002).
 */
const optionalTextSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null));

const adverseEventSchema = z.object({
  severity: z.enum(AdverseEventSeverity),
  description: requiredTextSchema,
});

/** Evento adverso registrado dentro de la evolución (FR-041 · US10-AC2), clínicamente diferenciado. */
export type AdverseEvent = z.infer<typeof adverseEventSchema>;

/**
 * Lista obligatoria que puede ser vacía: la clave siempre existe (SC-023 exige el 100 % de
 * los categóricos presentes) y `[]` significa «sin eventos adversos en esta entrada».
 */
const adverseEventsSchema = z.array(adverseEventSchema);

export const feedbackContentSchema = z.object({
  /** Consulta referida (FR-039): la fecha de registro es la del propio registro. */
  consultationId: requiredTextSchema,
  treatmentApplied: optionalTextSchema,
  adherence: z.enum(Adherence),
  evolution: z.enum(Evolution),
  evolutionNote: optionalTextSchema,
  /** `[]` = «sin eventos adversos en esta entrada» (la clave siempre existe: SC-023). */
  adverseEvents: adverseEventsSchema,
  revisedDiagnosis: optionalTextSchema,
  treatmentModification: optionalTextSchema,
});

/**
 * Contenido de una entrada de retroalimentación clínica (FR-018, FR-040, FR-041, FR-057):
 * `treatmentApplied` y `treatmentModification` son campos distintos (US10-AC10) y
 * `revisedDiagnosis` guarda el cambio de diagnóstico sin tocar el original (US10-AC4).
 * El servidor replica esta validación en `validate_clinical_feedback` (D5 de design.md).
 */
export type FeedbackContent = z.infer<typeof feedbackContentSchema>;
