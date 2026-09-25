import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { listAnamnesisEntries } from "@/features/registro/anamnesis-service";
import { getConsultation } from "@/features/registro/consultation-service";
import { getPatient } from "@/features/registro/ficha-service";
import { invalidateRegistro } from "@/features/registro/query-cache";
import {
  confirmAudioFact,
  createAudioFactDrafts,
  listAudioFacts,
} from "@/features/voz/audio-fact-service";
import {
  type ContextoContradicciones,
  esNegativo,
  type FichaComparable,
  flagContradictions,
} from "@/features/voz/contradictions";
import { extractClinicalFacts } from "@/features/voz/extraction";
import type { ListenModeController } from "@/features/voz/listen-mode-controller";
import { endListenSession } from "@/features/voz/listen-session-service";
import {
  saveTranscriptSegment,
  settleTranscriptSegment,
  type TranscriptSegmentEntry,
} from "@/features/voz/transcript-service";
import type { AudioWindow, TranscriptResult } from "@/features/voz/transcription-port";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Orquestación del modo de escucha, sin React (D3 · D5 del diseño; FR-016 · FR-032 · FR-055 ·
 * SC-028 · US6-AC12). El hook `useListenMode` solo conecta estas funciones con el estado de la
 * interfaz; aquí vive lo que se prueba con unitarias mientras la sección no esté montada en la
 * pantalla de consulta (riesgo R2). Revisión de la PR #29: hallazgos 1, 2, 3, 6 y 10.
 */

/** Prefijo de las consultas de React Query del modo de escucha. */
export const VOZ_QUERY_KEY = ["voz"] as const;

export type ContextoLoader = () => Promise<ContextoContradicciones>;

export type TramoDeps = {
  client: SupabaseClient<Database>;
  clinicId: string;
  consultationId: string;
  cargarContexto: ContextoLoader;
  /** Aviso tras cada escritura (el hook invalida las consultas del modo de escucha). */
  onWritten?: () => void;
};

async function leerFicha(
  client: SupabaseClient<Database>,
  consultationId: string,
): Promise<FichaComparable[]> {
  const consulta = await getConsultation(client, consultationId);
  const patientId = consulta?.content.patientId ?? null;
  if (!patientId) {
    return [];
  }
  const ficha = await getPatient(client, patientId);
  const antecedentes = ficha?.content.antecedentes ?? null;
  if (!antecedentes) {
    return [];
  }
  const items: FichaComparable[] = [];
  for (const group of Object.keys(antecedentes) as Array<keyof typeof antecedentes>) {
    for (const [index, item] of (antecedentes[group] ?? []).entries()) {
      items.push({ refId: `${group}-${index}`, group, text: item.text, negation: item.negative });
    }
  }
  return items;
}

/**
 * Contexto de contradicciones de una sesión de escucha (FR-032 · US6-AC8).
 *
 * - Los previos son solo los borradores PENDIENTES: los descartados ya los rechazó el
 *   veterinario y los confirmados están aterrizados en la anamnesis, que se compara aparte.
 * - La polaridad de lo ya registrado se calcula con la misma regla que la del hecho nuevo
 *   (`esNegativo`); fijarla en `false` hacía la comparación asimétrica.
 * - SC-028: hechos y anamnesis cambian con cada tramo y se leen en paralelo; consulta y ficha
 *   no cambian durante la escucha y se leen una sola vez por sesión (un fallo se reintenta en
 *   el tramo siguiente).
 */
export function crearCargadorContexto(
  client: SupabaseClient<Database>,
  consultationId: string,
): ContextoLoader {
  let ficha: Promise<FichaComparable[]> | null = null;
  return async () => {
    ficha ??= leerFicha(client, consultationId).catch((error: unknown) => {
      ficha = null;
      throw error;
    });
    const [hechos, anamnesis, fichaItems] = await Promise.all([
      listAudioFacts(client, consultationId),
      listAnamnesisEntries(client, consultationId),
      ficha,
    ]);
    return {
      previos: hechos
        .filter((hecho) => hecho.content.confirmationState === "pending")
        .map((hecho) => ({
          id: hecho.record.id,
          field: hecho.content.field,
          text: hecho.content.text,
          negation: esNegativo(hecho.content.text),
        })),
      anamnesis: anamnesis.map((entrada) => ({
        id: entrada.record.id,
        field: entrada.content.field,
        text: entrada.content.text,
        negation: esNegativo(entrada.content.text),
      })),
      ficha: fichaItems,
    };
  };
}

function guardarTramo(
  deps: TramoDeps,
  window: AudioWindow,
  result: TranscriptResult,
): Promise<TranscriptSegmentEntry> {
  return saveTranscriptSegment(deps.client, {
    listenSessionId: window.listenSessionId,
    clinicId: deps.clinicId,
    seq: window.seq,
    startedAt: window.startedAt,
    endedAt: new Date(Date.parse(window.startedAt) + window.durationMs).toISOString(),
    text: result.text,
    quality: result.quality,
  });
}

/**
 * Procesa un tramo completo: lo guarda, extrae sus borradores con sus señales de contradicción
 * y lo marca `processed` (FR-016 · SC-028).
 *
 * FR-055 · US6-AC12: si la extracción o el alta de borradores falla, el tramo se marca
 * `discarded` antes de propagar el error: el alta en bloque es atómica, así que no quedó ningún
 * borrador suyo y el tramo no se queda `pending` para siempre.
 */
export async function procesarTramo(
  deps: TramoDeps,
  window: AudioWindow,
  result: TranscriptResult,
): Promise<void> {
  const tramo = await guardarTramo(deps, window, result);
  try {
    const propuestas = extractClinicalFacts({ text: result.text, quality: result.quality });
    if (propuestas.length > 0) {
      const contexto = await deps.cargarContexto();
      // FR-032 · US6-AC8: cada propuesta del tramo ve a las anteriores del mismo lote, de modo
      // que la autocorrección intra-tramo dispara su insignia.
      await createAudioFactDrafts(deps.client, {
        clinicId: deps.clinicId,
        consultationId: deps.consultationId,
        transcriptSegmentId: tramo.id,
        segmentSeq: window.seq,
        segmentText: result.text,
        drafts: flagContradictions(propuestas, contexto),
      });
    }
  } catch (error) {
    // Mejor esfuerzo: settleTranscriptSegment ya reporta su propio fallo, y el error que
    // importa propagar es el original.
    await settleTranscriptSegment(deps.client, {
      segmentId: tramo.id,
      processingState: "discarded",
    }).catch(() => undefined);
    deps.onWritten?.();
    throw error;
  }
  await settleTranscriptSegment(deps.client, { segmentId: tramo.id, processingState: "processed" });
  deps.onWritten?.();
}

/**
 * Resuelve el tramo que la detención encontró a mitad (FR-055 · US6-AC12). `processed` lo
 * procesa de verdad —extrae y crea sus borradores— en vez de solo etiquetarlo; `discarded` lo
 * guarda y lo descarta sin derivar hechos.
 */
export async function resolverTramoInterrumpido(
  deps: TramoDeps,
  window: AudioWindow,
  result: TranscriptResult,
  decision: "processed" | "discarded",
): Promise<void> {
  if (decision === "processed") {
    await procesarTramo(deps, window, result);
    return;
  }
  const tramo = await guardarTramo(deps, window, result);
  await settleTranscriptSegment(deps.client, { segmentId: tramo.id, processingState: "discarded" });
  deps.onWritten?.();
}

/**
 * Recorre el ciclo de captura y cierra SIEMPRE la sesión de escucha con su estado terminal
 * (D8 · US6-AC12): `interrupted` si hubo tramo interrumpido o el ciclo falló, `stopped` si
 * terminó con normalidad. Los errores se reportan por `onError` y no se propagan: quien llama
 * lanza el ciclo en segundo plano.
 */
export async function ejecutarEscucha(input: {
  client: SupabaseClient<Database>;
  controller: Pick<ListenModeController, "run" | "wasInterrupted">;
  sessionId: string;
  onError: (error: unknown) => void;
}): Promise<void> {
  let falló = false;
  try {
    await input.controller.run();
  } catch (error) {
    falló = true;
    input.onError(error);
  }
  try {
    await endListenSession(input.client, {
      sessionId: input.sessionId,
      state: falló || input.controller.wasInterrupted ? "interrupted" : "stopped",
    });
  } catch (error) {
    input.onError(error);
  }
}

/**
 * Confirma un hecho y refresca lo que la confirmación cambia: el propio hecho (modo de escucha)
 * y la anamnesis aterrizada en el registro (D5). Sin invalidar `['registro']`, el workspace de la
 * consulta no mostraría la entrada nueva hasta que caducara su `staleTime`.
 */
export async function confirmarHecho(
  input: { client: SupabaseClient<Database>; queryClient: QueryClient },
  factId: string,
): Promise<void> {
  await confirmAudioFact(input.client, factId);
  await Promise.all([
    input.queryClient.invalidateQueries({ queryKey: VOZ_QUERY_KEY }),
    invalidateRegistro(input.queryClient),
  ]);
}
