import { z } from "zod";
import { AnamnesisField } from "@/features/registro/schema";

/**
 * Forma del contenido de la captura de voz hacia anamnesis (D1, D8 y D10 del diseño del cambio).
 *
 * Reglas aplicadas en esta frontera (Principio V, toda entrada validada con Zod):
 * - `provenance` del flujo de voz es fijamente `inferida` (FR-021 · US6-AC9): el antecedente lo
 *   infiere el sistema del audio transcrito y confirmarlo NO cambia su procedencia.
 * - `confirmationState` es el estado de confirmación que la spec 002 anticipó en su Observación
 *   clínica: `pending → confirmed | discarded`, con estados terminales sellados por el servidor
 *   (D5 · D6 · FR-017).
 * - `transcriptSegmentId` + `transcriptExcerpt` + `segmentSeq` hacen trazable cada hecho hasta el
 *   fragmento de transcripción que lo originó (SC-027 · US6-AC6); `anamnesisEntryId` lo deriva el
 *   servidor al confirmar (D5).
 * - `contradiction` solo SEÑALA una contradicción detectada (FR-032): la resolución es siempre
 *   del veterinario.
 */

const requiredTextSchema = z.string().trim().min(1, "Este campo es obligatorio.");

export const transcriptQualitySchema = z.enum(["ok", "insufficient"]);

/** Marca de confiabilidad por tramo de transcripción (FR-031 · D10). */
export type TranscriptQuality = z.infer<typeof transcriptQualitySchema>;

export const confirmationStateSchema = z.enum(["pending", "confirmed", "discarded"]);

/** Estado de confirmación de un hecho extraído del audio (D1 · FR-017). */
export type ConfirmationState = z.infer<typeof confirmationStateSchema>;

const contradictionSchema = z.object({
  refKind: z.enum(["borrador", "ficha", "anamnesis"]),
  refId: requiredTextSchema,
  note: requiredTextSchema,
});

/** Señal de contradicción adjunta al borrador (FR-032 · US6-AC8). */
export type ContradictionSignal = z.infer<typeof contradictionSchema>;

export const audioFactContentSchema = z.object({
  consultationId: requiredTextSchema,
  field: z.enum(AnamnesisField),
  text: requiredTextSchema,
  provenance: z.literal("inferida"),
  confirmationState: confirmationStateSchema,
  transcriptSegmentId: requiredTextSchema,
  transcriptExcerpt: requiredTextSchema,
  segmentSeq: z.number().int().nonnegative(),
  anamnesisEntryId: z.string().trim().min(1).nullish(),
  contradiction: contradictionSchema.nullish(),
});

/** Contenido del hecho extraído del audio (D1 · FR-021 · SC-027). */
export type AudioFactContent = z.infer<typeof audioFactContentSchema>;

export const transcriptSegmentSchema = z.object({
  listenSessionId: requiredTextSchema,
  clinicId: requiredTextSchema,
  seq: z.number().int().nonnegative(),
  startedAt: requiredTextSchema,
  endedAt: requiredTextSchema,
  text: z.string(),
  quality: transcriptQualitySchema,
  processingState: z.enum(["pending", "processed", "discarded"]),
});

/** Tramo de transcripción persistido (D10 · FR-031 · US6-AC12). */
export type TranscriptSegmentContent = z.infer<typeof transcriptSegmentSchema>;

export const listeningSessionSchema = z.object({
  clinicId: requiredTextSchema,
  consultationId: requiredTextSchema,
  state: z.enum(["active", "stopped", "interrupted"]),
});

/** Sesión de escucha (D8 · FR-068): periodo de captura dentro de una consulta. */
export type ListeningSessionContent = z.infer<typeof listeningSessionSchema>;

export const extractedFactDraftSchema = z.object({
  field: z.enum(AnamnesisField),
  text: requiredTextSchema,
  excerptStart: z.number().int().nonnegative(),
  excerptEnd: z.number().int().positive(),
});

/** Propuesta de antecedente extraída de un tramo, con su fragmento de origen (D4 · SC-027). */
export type ExtractedFactDraft = z.infer<typeof extractedFactDraftSchema>;
