import {
  Adherence,
  AdverseEventSeverity,
  type AdverseEvent,
  Evolution,
  type Adherence as AdherenceValue,
  type Evolution as EvolutionValue,
  type FeedbackContent,
} from "@/features/retroalimentacion/schema";
import type { ClinicalRecordRow } from "@/features/registro/summaries";

/**
 * Lecturas de la retroalimentación clínica como funciones puras (D8 del diseño del cambio).
 * Las consultas Supabase son aparte: aquí solo se deriva presentación de las filas ya leídas.
 */

/** Entrada de retroalimentación leída desde la traza clínica (D7: la cadena de correcciones). */
export type FeedbackEntry = {
  record: ClinicalRecordRow;
  content: FeedbackContent;
  /** Id del registro original que esta entrada corrige; `null` cuando la entrada es original. */
  correctsRecordId: string | null;
};

/** Entrada de la cronología con su lugar en la cadena de correcciones (FR-024 · US10-AC5). */
export type FeedbackTimelineEntry = FeedbackEntry & {
  /** Id de la corrección que la sustituyó (siguiente de su cadena); `null` si no fue corregida. */
  supersededByRecordId: string | null;
  /** Versión vigente de su cadena: no tiene corrección posterior. */
  effective: boolean;
};

/** Evento adverso recuperado de forma diferenciada, con el contexto de su entrada (FR-041). */
export type AdverseEventReportEntry = {
  feedbackRecordId: string;
  consultationId: string;
  /** Fecha de registro de la entrada (FR-039); la fecha de la consulta es la de su consulta. */
  registeredAt: string;
  /** Indica si su entrada sigue vigente o fue sustituida por una corrección. */
  effective: boolean;
  event: AdverseEvent;
};

/** Agregado de los campos categóricos, sin interpretar texto libre (FR-043 · SC-023). */
export type FeedbackAggregates = {
  total: number;
  adherence: Record<AdherenceValue, number>;
  evolution: Record<EvolutionValue, number>;
  adverseEvents: Record<AdverseEventSeverity, number>;
};

/** Evolución previa en forma de antecedente presentable (FR-042 · US10-AC6). */
export type FeedbackAntecedent = {
  feedbackRecordId: string;
  consultationId: string;
  /** Fecha de la consulta referida (FR-039 · US10-AC7): distinta de `registeredAt`. */
  consultationDate: string | null;
  /** Fecha de registro de la retroalimentación (FR-039 · US10-AC7). */
  registeredAt: string;
  adherence: AdherenceValue;
  evolution: EvolutionValue;
  evolutionNote: string | null;
  adverseEvents: AdverseEvent[];
  treatmentApplied: string | null;
  treatmentModification: string | null;
  revisedDiagnosis: string | null;
};

function instante(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Orden cronológico por `created_at` (servidor, UTC); el `id` desempata el determinismo. */
function compararFilas(a: ClinicalRecordRow, b: ClinicalRecordRow): number {
  return instante(a.created_at) - instante(b.created_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function recuentoCero<T extends string>(valores: readonly T[]): Record<T, number> {
  const recuento = {} as Record<T, number>;
  for (const valor of valores) {
    recuento[valor] = 0;
  }
  return recuento;
}

/**
 * Cronología de las entradas de retroalimentación de una consulta, o de todas (FR-056 ·
 * US10-AC11): nada se sobrescribe, las varias entradas conviven en orden cronológico.
 *
 * Cadena de correcciones (D7 · FR-024 · US10-AC5): cada corrección resuelve a su original por
 * `correctsRecordId` y las sucesivas apuntan al mismo. La más reciente de la cadena es la
 * versión vigente (`effective`); cada entrada anterior queda con `supersededByRecordId`
 * apuntando a quien la sustituyó, y el original permanece siempre recuperable.
 */
export function buildFeedbackTimeline(
  entries: FeedbackEntry[],
  consultationId?: string,
): FeedbackTimelineEntry[] {
  const ordenadas = [...entries]
    .filter((entry) => consultationId === undefined || entry.content.consultationId === consultationId)
    .sort((a, b) => compararFilas(a.record, b.record));

  const cadenas = new Map<string, FeedbackEntry[]>();
  for (const entry of ordenadas) {
    const clave = entry.correctsRecordId ?? entry.record.id;
    const cadena = cadenas.get(clave);
    if (cadena) {
      cadena.push(entry);
    } else {
      cadenas.set(clave, [entry]);
    }
  }

  const sustituidaPor = new Map<string, string | null>();
  const vigentes = new Set<string>();
  for (const cadena of cadenas.values()) {
    cadena.forEach((entry, indice) => {
      sustituidaPor.set(entry.record.id, cadena[indice + 1]?.record.id ?? null);
    });
    const ultima = cadena[cadena.length - 1];
    if (ultima) {
      vigentes.add(ultima.record.id);
    }
  }

  return ordenadas.map((entry) => ({
    ...entry,
    supersededByRecordId: sustituidaPor.get(entry.record.id) ?? null,
    effective: vigentes.has(entry.record.id),
  }));
}

/**
 * Eventos adversos registrados, diferenciados del resto de la evolución (FR-041 · SC-035 ·
 * US10-AC2). Recupera el 100 % de los eventos, incluidos los de entradas ya sustituidas, cada
 * uno con su contexto y su marca `effective`; el `grave` llega como valor del vocabulario de
 * severidad y nunca se diluye entre observaciones generales.
 */
export function collectAdverseEvents(timeline: FeedbackTimelineEntry[]): AdverseEventReportEntry[] {
  return timeline.flatMap((entry) =>
    entry.content.adverseEvents.map((event) => ({
      feedbackRecordId: entry.record.id,
      consultationId: entry.content.consultationId,
      registeredAt: entry.record.created_at,
      effective: entry.effective,
      event,
    })),
  );
}

/**
 * Recuento agregado de los campos categóricos por categoría (FR-043 · SC-023 · US10-AC9),
 * sin interpretar texto libre. Agrega solo las versiones vigentes: una corrección reemplaza la
 * verdad agregada y las versiones sustituidas siguen recuperables en la cronología (US10-AC5).
 */
export function aggregateFeedback(timeline: FeedbackTimelineEntry[]): FeedbackAggregates {
  const agregados: FeedbackAggregates = {
    total: 0,
    adherence: recuentoCero(Adherence),
    evolution: recuentoCero(Evolution),
    adverseEvents: recuentoCero(AdverseEventSeverity),
  };

  for (const entry of timeline) {
    if (!entry.effective) {
      continue;
    }
    agregados.total += 1;
    agregados.adherence[entry.content.adherence] += 1;
    agregados.evolution[entry.content.evolution] += 1;
    for (const evento of entry.content.adverseEvents) {
      agregados.adverseEvents[evento.severity] += 1;
    }
  }

  return agregados;
}

/**
 * Evolución previa del paciente como antecedentes presentables (FR-042 · US10-AC6), solo
 * versiones vigentes y sin la consulta excluida (la en curso). Cada antecedente distingue su
 * fecha de registro de la fecha de la consulta que refiere (FR-039 · US10-AC7). Es el dato que
 * la futura extensión de `buildFollowUpSummary` consumirá (D9, requisito de integración).
 */
export function buildFeedbackAntecedents(input: {
  timeline: FeedbackTimelineEntry[];
  consultations: ClinicalRecordRow[];
  excludeConsultationId?: string;
}): FeedbackAntecedent[] {
  const fechaConsulta = new Map<string, string>();
  for (const consulta of input.consultations) {
    fechaConsulta.set(consulta.id, consulta.created_at);
  }

  return input.timeline
    .filter((entry) => entry.effective)
    .filter(
      (entry) =>
        input.excludeConsultationId === undefined ||
        entry.content.consultationId !== input.excludeConsultationId,
    )
    .map((entry) => ({
      feedbackRecordId: entry.record.id,
      consultationId: entry.content.consultationId,
      consultationDate: fechaConsulta.get(entry.content.consultationId) ?? null,
      registeredAt: entry.record.created_at,
      adherence: entry.content.adherence,
      evolution: entry.content.evolution,
      evolutionNote: entry.content.evolutionNote,
      adverseEvents: entry.content.adverseEvents,
      treatmentApplied: entry.content.treatmentApplied,
      treatmentModification: entry.content.treatmentModification,
      revisedDiagnosis: entry.content.revisedDiagnosis,
    }));
}
