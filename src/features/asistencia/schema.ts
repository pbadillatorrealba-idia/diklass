import { z } from "zod";
import {
  avisoRespuestaSchema,
  type AvisoRespuesta,
  citaSchema,
  type Cita,
  coberturaSchema,
  type Cobertura,
} from "@/features/conocimiento/schema";
import {
  anamnesisContentSchema,
  type AnamnesisContent,
  type Provenance,
} from "@/features/registro/schema";

/**
 * Forma del contenido y de la presentación de la asistencia clínica proactiva (D2 y D5 del
 * diseño del cambio). Toda frontera de entrada se valida con Zod (Principio V).
 *
 * Reglas aplicadas en esta frontera:
 * - `missing_information` ES la decisión registrada: `estado` solo admite estados decididos
 *   (`pendiente` es derivado por detección, D3 · HD3).
 * - `hypothesis.decision` (`added|accepted|discarded`) es la única marca de estado persistida
 *   (D7 · HD4): es exactamente lo que consume el mapping de FR-063 de 001
 *   (`content->>'decision'`); el `estado` en español de la epicrisis se deriva con
 *   `composeHipotesisConsideradas` (FR-049).
 * - `insumos` documentan qué produjo la hipótesis (referencias de anamnesis con su procedencia
 *   canónica de FR-021 y referencias de ficha, más los términos que dispararon la regla) y
 *   `respaldo` la evidencia documental del contrato de 003 (citas documento+fragmento y avisos).
 */

const requiredTextSchema = z.string().trim().min(1, "Este campo es obligatorio.");

export const decisionSugerenciaSchema = z.enum(["formulada", "ignorada", "no_aplicable"]);

/** Estados decididos de una sugerencia de información faltante (FR-008 · US7-AC2/AC6). */
export type DecisionSugerencia = z.infer<typeof decisionSugerenciaSchema>;

export const decisionHipotesisSchema = z.enum(["added", "accepted", "discarded"]);

/** Marca de decisión de una hipótesis (FR-029 · US8-AC2 · D7). */
export type DecisionHipotesis = z.infer<typeof decisionHipotesisSchema>;

export const origenHipotesisSchema = z.enum(["sistema", "veterinario"]);

/** Origen de la candidatura: propuesta por el sistema o agregada por el veterinario (US8-AC9). */
export type OrigenHipotesis = z.infer<typeof origenHipotesisSchema>;

export const papelInsumoSchema = z.enum(["aFavor", "enContra"]);

/** Papel de un antecedente frente a la hipótesis (FR-009 · US8-AC1). */
export type PapelInsumo = z.infer<typeof papelInsumoSchema>;

export const fundamentoSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("fuente"), cita: citaSchema }),
  z.strictObject({ kind: z.literal("criterio_general") }),
]);

/**
 * Fundamento de una sugerencia (FR-033 · US7-AC3/AC5): fuente citada documento+fragmento o
 * criterio general declarado como tal — jamás una cita que no exista (FR-023).
 */
export type Fundamento = z.infer<typeof fundamentoSchema>;

export const missingInformationContentSchema = z.object({
  consultationId: requiredTextSchema,
  suggestionKey: requiredTextSchema,
  pregunta: requiredTextSchema,
  estado: decisionSugerenciaSchema,
  fundamento: fundamentoSchema,
  camposRelacionados: z.array(z.string()),
});

/** Contenido de la fila `missing_information`: la decisión registrada (D3). */
export type MissingInformationContent = z.infer<typeof missingInformationContentSchema>;

const { field, text, provenance } = anamnesisContentSchema.shape;

export const insumoAnamnesisSchema = z.object({
  recordId: requiredTextSchema,
  field,
  text,
  provenance,
  papel: papelInsumoSchema,
});

/** Antecedente de anamnesis usado por la regla, con su referencia y procedencia (FR-020 · FR-021). */
export type InsumoAnamnesis = z.infer<typeof insumoAnamnesisSchema>;

export const insumoFichaSchema = z.object({
  fichaRef: requiredTextSchema,
  valor: z.string().nullable(),
  papel: papelInsumoSchema,
});

/** Ítem de la ficha usado por la regla (FR-020 · US8-AC8). */
export type InsumoFicha = z.infer<typeof insumoFichaSchema>;

export const insumosHipotesisSchema = z.object({
  anamnesis: z.array(insumoAnamnesisSchema),
  ficha: z.array(insumoFichaSchema),
  faltante: z.array(z.string()),
  terminosMatch: z.array(z.string()),
});

/** Insumos que produjeron la hipótesis: la reconstrucción de FR-020 (US8-AC8). */
export type InsumosHipotesis = z.infer<typeof insumosHipotesisSchema>;

export const respaldoHipotesisSchema = z.object({
  knowledgeQueryId: z.string().min(1).nullable(),
  citas: z.array(citaSchema),
  avisos: z.array(avisoRespuestaSchema),
  cobertura: coberturaSchema.nullable(),
});

/** Respaldo documental de la hipótesis, del contrato de respuesta de 003 (FR-007 · FR-023). */
export type RespaldoHipotesis = z.infer<typeof respaldoHipotesisSchema>;

export const hypothesisContentSchema = z.object({
  consultationId: requiredTextSchema,
  texto: requiredTextSchema,
  decision: decisionHipotesisSchema,
  origen: origenHipotesisSchema,
  reglaId: z.string().min(1).nullable(),
  insumos: insumosHipotesisSchema,
  respaldo: respaldoHipotesisSchema,
});

/** Contenido de la fila `hypothesis` (D2 · D7). */
export type HypothesisContent = z.infer<typeof hypothesisContentSchema>;

/** Lectura de una anamnesis registrada: identidad de la fila + su contenido validado (002). */
export type EntradaAnamnesis = { recordId: string; content: AnamnesisContent };

/** Descargo obligatorio de toda presentación (FR-010 · US8-AC3 · SC-031). */
export const DESCARGO_ASISTENCIA =
  "Apoyo a la decisión clínica: lo propuesto por el sistema no constituye un diagnóstico y " +
  "toda salida queda sujeta a la validación del veterinario.";

export type ItemAnalisis = {
  ref: string;
  campo: string;
  texto: string;
  provenance: Provenance;
  papel: PapelInsumo;
};

/** Sección del análisis con sus ítems o su ausencia explícita (SC-019). */
export type SeccionAnalisis = { items: ItemAnalisis[]; ausencia: string | null };

export type AnalisisHipotesis = {
  aFavor: SeccionAnalisis;
  enContra: SeccionAnalisis;
  faltante: { campos: string[]; ausencia: string | null };
};

export type RespaldoPresentado = RespaldoHipotesis & { sinRespaldo: boolean };

/** Hipótesis tal como se presenta al veterinario: análisis, respaldo citado y descargo. */
export type HipotesisSoportada = {
  key: string;
  texto: string;
  origen: OrigenHipotesis;
  decision: DecisionHipotesis;
  reglaId: string | null;
  analisis: AnalisisHipotesis;
  respaldo: RespaldoPresentado;
  insumos: InsumosHipotesis;
  descargo: string;
};
