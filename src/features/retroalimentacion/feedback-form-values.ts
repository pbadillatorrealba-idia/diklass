import { z } from "zod";
import {
  Adherence,
  type Adherence as AdherenceValue,
  AdverseEventSeverity,
  type AdverseEventSeverity as AdverseEventSeverityValue,
  Evolution,
  type Evolution as EvolutionValue,
  type FeedbackContent,
  feedbackContentSchema,
} from "@/features/retroalimentacion/schema";
import { getFieldErrors } from "@/lib/forms/errors";

/**
 * Lógica del formulario de retroalimentación (patrón de `@/lib/forms/form` y
 * `parseFichaValues` de 002): valores de control, primer paso de validación con mensajes en
 * español y conversión al contenido de D2. Vive fuera del componente para poderse probar sin
 * el runtime de React Native (mismo criterio que `loginSchema`).
 */

export type AdverseEventFormValue = {
  severity: AdverseEventSeverityValue;
  description: string;
};

export type FeedbackFormValues = {
  adherence: AdherenceValue;
  evolution: EvolutionValue;
  evolutionNote: string;
  treatmentApplied: string;
  treatmentModification: string;
  revisedDiagnosis: string;
  adverseEvents: AdverseEventFormValue[];
};

export type FeedbackFormField = Exclude<
  keyof FeedbackFormValues,
  "adherence" | "evolution" | "adverseEvents"
>;

/**
 * Selecciones categóricas en `desconocida` por omisión (FR-040): el registro por defecto es
 * incertidumbre explícita, nunca precisión falsa; el veterinario cambia lo que sí conoce.
 */
export const emptyFeedbackFormValues: FeedbackFormValues = {
  adherence: "desconocida",
  evolution: "desconocida",
  evolutionNote: "",
  treatmentApplied: "",
  treatmentModification: "",
  revisedDiagnosis: "",
  adverseEvents: [],
};

const adverseEventFormSchema = z.object({
  severity: z.enum(AdverseEventSeverity),
  description: z.string().trim().min(1, "Describe el evento adverso."),
});

const feedbackFormSchema = z.object({
  adherence: z.enum(Adherence),
  evolution: z.enum(Evolution),
  evolutionNote: z.string().trim(),
  treatmentApplied: z.string().trim(),
  treatmentModification: z.string().trim(),
  revisedDiagnosis: z.string().trim(),
  adverseEvents: z.array(adverseEventFormSchema),
});

/**
 * Prefill del formulario desde un contenido ya registrado (flujo de corrección de US10-AC5):
 * los `null` del modelo vuelven a texto vacío del formulario, sin inventar datos.
 */
export function feedbackFormValuesFromContent(content: FeedbackContent): FeedbackFormValues {
  return {
    adherence: content.adherence,
    evolution: content.evolution,
    evolutionNote: content.evolutionNote ?? "",
    treatmentApplied: content.treatmentApplied ?? "",
    treatmentModification: content.treatmentModification ?? "",
    revisedDiagnosis: content.revisedDiagnosis ?? "",
    adverseEvents: content.adverseEvents.map((evento) => ({ ...evento })),
  };
}

/**
 * Convierte los valores del formulario en el contenido de una entrada (D2), con la consulta
 * referida (FR-039). Los textos vacíos se vuelven `null` en el modelo: vacío no es
 * información (FR-057 · US10-AC12). El resultado ya viene validado por
 * `feedbackContentSchema`.
 */
export function parseFeedbackValues(
  values: FeedbackFormValues,
  consultationId: string,
): { value: FeedbackContent | null; errors: Record<string, string> } {
  const formResult = feedbackFormSchema.safeParse(values);
  if (!formResult.success) {
    return { value: null, errors: getFieldErrors(formResult.error) };
  }
  const clean = formResult.data;
  const contentResult = feedbackContentSchema.safeParse({
    consultationId,
    adherence: clean.adherence,
    evolution: clean.evolution,
    evolutionNote: clean.evolutionNote,
    adverseEvents: clean.adverseEvents,
    treatmentApplied: clean.treatmentApplied,
    treatmentModification: clean.treatmentModification,
    revisedDiagnosis: clean.revisedDiagnosis,
  });
  if (!contentResult.success) {
    return { value: null, errors: getFieldErrors(contentResult.error) };
  }
  return { value: contentResult.data, errors: {} };
}
