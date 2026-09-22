import {
  type AntecedentGroup,
  consultationContentSchema,
  type EpicrisisContent,
  epicrisisContentSchema,
  type PatientContent,
} from "@/features/registro/schema";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Lecturas del registro clínico longitudinal como funciones puras (D10 del diseño del cambio).
 * Las consultas Supabase son aparte: aquí solo se deriva presentación de las filas ya leídas.
 */

export type ClinicalRecordRow = Database["public"]["Tables"]["clinical_records"]["Row"];

export type ConsultationHistoryEntry = {
  consultationId: string;
  openedAt: string;
  status: "open" | "closed";
  epicrisis: EpicrisisContent | null;
  /** La versión original fue superseded por una corrección y permanece recuperable (US3-AC4). */
  epicrisisSuperseded: boolean;
};

export type FollowUpSummary = {
  previousDiagnoses: string[];
  interventions: string[];
  recommendations: string[];
  exams: string[];
  pendingItems: string[];
};

/**
 * FR-044: `sin_dato` marca un campo sin información; `sin_registrar_grupo`, un grupo de
 * antecedentes sin ningún ítem registrado.
 */
export type MissingField = {
  field: string;
  kind: "sin_dato" | "sin_registrar_grupo";
};

const ANTECEDENT_GROUPS: AntecedentGroup[] = [
  "medicalHistory",
  "preexistingDiseases",
  "currentMedications",
  "knownAllergies",
  "behavioralHistory",
];

function instante(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Orden cronológico por `created_at` (servidor, UTC); el `id` desempata el determinismo. */
function compararFilas(a: ClinicalRecordRow, b: ClinicalRecordRow): number {
  return (
    instante(a.created_at) - instante(b.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

function consultaDelContenido(content: ClinicalRecordRow["content"]): string | null {
  if (typeof content !== "object" || content === null || Array.isArray(content)) {
    return null;
  }
  const value = content.consultationId;
  return typeof value === "string" ? value : null;
}

/**
 * Epicrisis efectiva de una consulta (FR-010, FR-024 · US3-AC4).
 *
 * Candidatas: filas de epicrisis de la consulta con `status` 'approved' o 'corrective'. Un
 * borrador ('draft') nunca es efectivo: nada entra al historial sin validación explícita.
 *
 * Cadena de supersede (D8): una corrección es una fila 'corrective' cuyo `supersedes_event_id`
 * apunta al evento `epicrisis_approved` del ORIGINAL (todas las correcciones sucesivas apuntan
 * al mismo evento original; nunca al `corrective_record_created` de una corrección anterior —
 * `correctEpicrisis` siempre repunta al original, y este docstring debe reflejarlo). Esos ids
 * viven en `clinical_audit_events`, no en la fila, así que dentro de esta vista pura la cadena
 * se resuelve por orden cronológico: la candidata más reciente (`created_at`; empate por `id`)
 * es el extremo de la cadena y por tanto la efectiva. Una fila 'corrective' sin
 * `supersedes_event_id` no es una corrección válida y queda fuera de la cadena. El original
 * superseded permanece legible y recuperable en la traza (FR-024).
 */
export function effectiveEpicrisis(
  rows: ClinicalRecordRow[],
  consultationId: string,
): ClinicalRecordRow | null {
  const candidatas = rows.filter(
    (row) =>
      consultaDelContenido(row.content) === consultationId &&
      (row.status === "approved" ||
        (row.status === "corrective" && row.supersedes_event_id !== null)),
  );
  return [...candidatas].sort(compararFilas).at(-1) ?? null;
}

/**
 * Historial cronológico de las consultas de un paciente (FR-002 · US4-AC4).
 *
 * Cada entrada lleva su epicrisis efectiva (o `null` si solo hay borradores o no hay ninguna)
 * y señala si esa efectiva corrige una versión previa, que permanece recuperable (FR-024).
 * El contenido inválido de una fila lanza el error de validación: no se silencia.
 */
export function buildPatientHistory(input: {
  consultations: ClinicalRecordRow[];
  epicrisis: ClinicalRecordRow[];
}): ConsultationHistoryEntry[] {
  return [...input.consultations].sort(compararFilas).map((row) => {
    const contenido = consultationContentSchema.parse(row.content);
    const efectiva = effectiveEpicrisis(input.epicrisis, row.id);
    return {
      consultationId: row.id,
      openedAt: row.created_at,
      status: contenido.status,
      epicrisis: efectiva ? epicrisisContentSchema.parse(efectiva.content) : null,
      epicrisisSuperseded: efectiva !== null && efectiva.status === "corrective",
    };
  });
}

/**
 * Resumen de seguimiento previo para una consulta nueva (FR-013 · US4-AC1/AC3).
 *
 * Solo aportan las epicrisis EFECTIVAS de consultas CERRADAS: un borrador o una consulta
 * abierta aún no son registro clínico (FR-010). Los pendientes salen de
 * `planSeguimiento.pendientes`; se conserva el orden cronológico de las consultas y no se
 * fusionan textos iguales. `excludeConsultationId` deja fuera la consulta en curso.
 */
export function buildFollowUpSummary(
  entries: ConsultationHistoryEntry[],
  excludeConsultationId?: string,
): FollowUpSummary {
  const resumen: FollowUpSummary = {
    previousDiagnoses: [],
    interventions: [],
    recommendations: [],
    exams: [],
    pendingItems: [],
  };
  for (const entry of entries) {
    if (entry.status !== "closed" || entry.epicrisis === null) {
      continue;
    }
    if (entry.consultationId === excludeConsultationId) {
      continue;
    }
    const { epicrisis } = entry;
    if (epicrisis.diagnostico.trim() !== "") {
      resumen.previousDiagnoses.push(epicrisis.diagnostico);
    }
    resumen.interventions.push(...epicrisis.intervencionesPropuestas);
    if (epicrisis.recomendacionesTutor.trim() !== "") {
      resumen.recommendations.push(epicrisis.recomendacionesTutor);
    }
    resumen.exams.push(...epicrisis.examenesSolicitados);
    resumen.pendingItems.push(...epicrisis.planSeguimiento.pendientes);
  }
  return resumen;
}

/**
 * Señalamiento de lo que falta en una ficha (FR-044 · US1-AC3).
 *
 * Un campo numérico o de fecha en `null` es `sin_dato`; un grupo de antecedentes sin ningún
 * ítem es `sin_registrar_grupo`. Un ítem `negative: true` es un hallazgo negativo
 * explícitamente registrado y deja al grupo como registrado: nunca se confunde con ausencia de
 * información. El orden de salida es estable (fechas y edad, peso, y los grupos en su orden).
 */
export function computeMissingFichaFields(content: PatientContent): MissingField[] {
  const faltantes: MissingField[] = [];
  if (content.birthDate === null) {
    faltantes.push({ field: "birthDate", kind: "sin_dato" });
  }
  if (content.ageMonths === null) {
    faltantes.push({ field: "ageMonths", kind: "sin_dato" });
  }
  if (content.weightKg === null) {
    faltantes.push({ field: "weightKg", kind: "sin_dato" });
  }
  for (const group of ANTECEDENT_GROUPS) {
    if (content.antecedentes[group].length === 0) {
      faltantes.push({ field: group, kind: "sin_registrar_grupo" });
    }
  }
  return faltantes;
}
