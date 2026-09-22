import { z } from "zod";
import type { Provenance } from "@/features/registro/schema";

/**
 * Frontera de validación de la base de conocimiento trazable (D2, D5 y D6 del diseño del
 * cambio). Toda entrada que cruza una frontera de confianza —ingesta de fuentes, filas de
 * la RPC de búsqueda y respuestas persistidas— se valida aquí con Zod (Principio V).
 *
 * El vocabulario de procedencia se cita del contrato de 002
 * (`@/features/registro/schema`) en vez de redefinirse: `PROCEDENCIA_POR_KIND` queda
 * atado por tipo a él, de modo que un cambio de vocabulario en 002 rompe aquí el
 * `bun run typecheck` y no se filtra silenciosamente.
 */

const requiredTextSchema = z.string().trim().min(1, "Este campo es obligatorio.");

const optionalTextSchema = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null));

export const bibliografiaSchema = z.object({
  titulo: requiredTextSchema,
  autores: z
    .array(z.string().trim().min(1, "Nombre de autor vacío."))
    .nullish()
    .transform((autores) => autores ?? []),
  anio: z
    .number()
    .int()
    .positive("Año de publicación inválido.")
    .nullish()
    .transform((value) => value ?? null),
  revista: optionalTextSchema,
  editorial: optionalTextSchema,
  edicion: optionalTextSchema,
  doi: optionalTextSchema,
  url: optionalTextSchema,
});

/** Información bibliográfica de una fuente clínica (FR-030). */
export type Bibliografia = z.infer<typeof bibliografiaSchema>;

export const licenciaSchema = z.object({
  tipo: requiredTextSchema,
  nota: optionalTextSchema,
});

/** Metadatos de licencia del documento (decisión de usuario sobre el corpus). */
export type Licencia = z.infer<typeof licenciaSchema>;

export const fragmentoSchema = z.object({
  ordinal: z.number().int().positive("El ordinal del fragmento empieza en 1."),
  seccion: optionalTextSchema,
  texto: requiredTextSchema,
});

/** Fragmento citable de una fuente: la cita es documento + este ordinal (D2). */
export type Fragmento = z.infer<typeof fragmentoSchema>;

export const fuenteContentSchema = z
  .object({
    bibliografia: bibliografiaSchema,
    licencia: licenciaSchema,
    fragmentos: z.array(fragmentoSchema).min(1, "Incluye al menos un fragmento citable."),
  })
  .refine(
    (fuente) => fuente.fragmentos.every((fragmento, indice) => fragmento.ordinal === indice + 1),
    {
      message: "Los fragmentos se numeran de 1 en adelante, sin huecos ni repetidos.",
      path: ["fragmentos"],
    },
  );

/** Contenido de una fuente clínica: forma de ingesta y de `content` en el servidor (D2). */
export type FuenteContent = z.infer<typeof fuenteContentSchema>;

/** Entrada de ingesta: misma forma que el contenido persistido (una fila = un documento). */
export type FuenteInput = FuenteContent;

export const citaSchema = z.object({
  documentoId: z.string().trim().min(1),
  fragmentoOrdinal: z.number().int().positive(),
  textoCitado: requiredTextSchema,
  bibliografia: bibliografiaSchema,
  licencia: licenciaSchema,
  estado: z.enum(["available", "withdrawn"]),
});

/** Cita documento+fragmento con su texto verbatim y su referencia bibliográfica (FR-007, FR-030). */
export type Cita = z.infer<typeof citaSchema>;

export type SegmentoKind = "evidencia" | "ficha" | "inferencia";

/**
 * Mapeo de los orígenes de la respuesta al vocabulario canónico de procedencia de FR-021
 * (brief §7, contrato de 002): lo documental es `recuperada`, lo de la ficha `reportada`
 * (o `desconocida` cuando el campo está sin dato) y lo derivado por el sistema `inferida`.
 */
export const PROCEDENCIA_POR_KIND = {
  evidencia: "recuperada",
  ficha: "reportada",
  inferencia: "inferida",
} as const satisfies Record<SegmentoKind, Provenance>;

const procedenciaFichaSchema = z.enum(["reportada", "desconocida"]);

/** Procedencia permitida en los segmentos de ficha (FR-021 · US5-AC3). */
export type ProcedenciaFicha = z.infer<typeof procedenciaFichaSchema>;

const segmentoEvidenciaSchema = z.object({
  id: requiredTextSchema,
  kind: z.literal("evidencia"),
  provenance: z.literal("recuperada"),
  texto: requiredTextSchema,
  cita: citaSchema,
});

const segmentoFichaSchema = z.object({
  id: requiredTextSchema,
  kind: z.literal("ficha"),
  provenance: procedenciaFichaSchema,
  texto: requiredTextSchema,
  fichaRef: requiredTextSchema,
});

const segmentoInferenciaSchema = z.object({
  id: requiredTextSchema,
  kind: z.literal("inferencia"),
  provenance: z.literal("inferida"),
  texto: requiredTextSchema,
});

export const segmentoRespuestaSchema = z.discriminatedUnion("kind", [
  segmentoEvidenciaSchema,
  segmentoFichaSchema,
  segmentoInferenciaSchema,
]);

/**
 * Segmento de la respuesta: los tres orígenes de FR-021 son taxativos y cada uno lleva su
 * procedencia. Solo `evidencia` contiene contenido clínico, y siempre como cita verbatim
 * (SC-010 por construcción).
 */
export type SegmentoRespuesta = z.infer<typeof segmentoRespuestaSchema>;

export const coberturaSchema = z.object({
  estado: z.enum(["sin_evidencia", "parcial", "cubre"]),
  cubiertos: z.array(z.string()),
  noCubiertos: z.array(z.string()),
});

/** Cobertura de la pregunta por la evidencia recuperada (FR-022 · US5-AC8). */
export type Cobertura = z.infer<typeof coberturaSchema>;

export const AvisoRespuesta = [
  "sin_respaldo_documental",
  "cobertura_parcial",
  "fuentes_multiples",
  "sin_paciente_seleccionado",
  "fuente_retirada",
] as const;

export const avisoRespuestaSchema = z.enum(AvisoRespuesta);

/**
 * Avisos explícitos de la respuesta (FR-022, FR-023, FR-051, FR-052 y FR-053): ausencia de
 * respaldo documental, cobertura parcial, fuentes sin arbitraje, modo sin paciente y cita
 * hacia fuente retirada.
 */
export type AvisoRespuesta = z.infer<typeof avisoRespuestaSchema>;

export const knowledgeAnswerSchema = z.object({
  pregunta: requiredTextSchema,
  patientId: z
    .string()
    .trim()
    .min(1)
    .nullish()
    .transform((value) => value ?? null),
  segmentos: z.array(segmentoRespuestaSchema),
  cobertura: coberturaSchema,
  avisos: z.array(avisoRespuestaSchema),
});

/**
 * Respuesta del asistente, tal como se persiste: es su propia reconstrucción (FR-020 ·
 * US5-AC5) — segmentos con snapshot de la ficha y citas documento+fragmento.
 */
export type KnowledgeAnswer = z.infer<typeof knowledgeAnswerSchema>;

export const knowledgeQueryRowSchema = z.object({
  id: z.string().trim().min(1),
  clinic_id: z.string().trim().min(1),
  question: requiredTextSchema,
  patient_id: z
    .string()
    .trim()
    .min(1)
    .nullish()
    .transform((value) => value ?? null),
  answer: knowledgeAnswerSchema,
  created_at: z.string().trim().min(1),
});

/** Fila de `knowledge_queries` (append-only) con su respuesta ya validada (D6). */
export type KnowledgeQueryRow = z.infer<typeof knowledgeQueryRowSchema>;

export const fragmentoRecuperadoSchema = z.object({
  documento_id: z.string().trim().min(1),
  fragmento_ordinal: z.number().int().positive(),
  texto: requiredTextSchema,
  seccion: optionalTextSchema,
  bibliografia: bibliografiaSchema,
  licencia: licenciaSchema,
  estado: z.enum(["available", "withdrawn"]),
  rank_cd: z.number(),
  lemas_cubiertos: z.array(z.string()),
  lemas_pregunta: z.array(z.string()),
});

/** Fila devuelta por `search_knowledge_fragments` con su cobertura de lemas (D4). */
export type FragmentoRecuperado = z.infer<typeof fragmentoRecuperadoSchema>;
