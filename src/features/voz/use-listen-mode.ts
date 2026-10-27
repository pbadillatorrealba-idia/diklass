import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type AudioFactEntry,
  discardAudioFactDraft,
  editAudioFactDraft,
  listAudioFacts,
} from "@/features/voz/audio-fact-service";
import { ListenModeController, type ListenModeState } from "@/features/voz/listen-mode-controller";
import { crearEntradas, MODO_REAL } from "@/features/voz/listen-mode-inputs";
import {
  confirmarHecho,
  crearCargadorContexto,
  ejecutarEscucha,
  procesarTramo,
  resolverTramoInterrumpido,
  type TramoDeps,
  VOZ_QUERY_KEY,
} from "@/features/voz/listen-mode-pipeline";
import { startListenSession } from "@/features/voz/listen-session-service";
import {
  listTranscriptSegments,
  type TranscriptSegmentEntry,
} from "@/features/voz/transcript-service";
import { startedAtFor } from "@/features/voz/use-elapsed";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";

/**
 * Orquestación del modo de escucha clínica (D2 · D3 · D5 del diseño; FR-014 · FR-015 · FR-016 ·
 * FR-032 · SC-028): activa la sesión de escucha, recorre las ventanas con micrófono y ASR reales
 * (`EXPO_PUBLIC_VOZ_MODO=real`) o con el guion simulado por defecto, persiste cada tramo, extrae borradores con sus señales de contradicción y los
 * deja confirmables antecedente por antecedente. La consulta abierta la exige el servidor
 * (011, US6-AC14) y la confirmación aterriza la anamnesis en el servidor (D5). La lógica vive en
 * `listen-mode-pipeline.ts` (probada con unitarias); este hook solo la conecta con la interfaz.
 */
export type ListenModeApi = {
  state: ListenModeState;
  /** Instante en que la captura pasó a `capturando`; `null` si no hay captura (`startedAtFor`). */
  startedAt: number | null;
  /** Micrófono y transcripción reales (D1): la interfaz avisa de la grabación y su conservación. */
  modoReal: boolean;
  facts: AudioFactEntry[];
  segments: TranscriptSegmentEntry[];
  isBusy: boolean;
  start: () => Promise<void>;
  stop: (decision?: "processed" | "discarded") => Promise<void>;
  confirmFact: (factId: string) => Promise<void>;
  discardFact: (factId: string) => Promise<void>;
  editFact: (factId: string, text: string) => Promise<void>;
};

export function useListenMode(
  consultationId: string,
  /** Se llama con la entrada de anamnesis aterrizada al confirmar un borrador (design.md D9). */
  onLanded?: (entryId: string) => void,
): ListenModeApi {
  const clinicId = useSessionStore((estado) => estado.clinicId) ?? "";
  const queryClient = useQueryClient();
  const [state, setState] = useState<ListenModeState>("inactivo");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busyFactId, setBusyFactId] = useState<string | null>(null);
  const controllerRef = useRef<ListenModeController | null>(null);
  // Siempre la última función: `confirmFact` no cambia de identidad con cada render.
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;

  // El reloj es de la captura: quien lo muestre (hilo, riel o cinta) cuenta desde este instante.
  useEffect(() => {
    setStartedAt((previous) => startedAtFor(previous, state, Date.now()));
  }, [state]);

  const factsQuery = useQuery({
    enabled: consultationId.length > 0,
    queryFn: () => listAudioFacts(supabase, consultationId),
    queryKey: ["voz", "audio-facts", consultationId],
  });
  const segmentsQuery = useQuery({
    enabled: sessionId !== null,
    queryFn: async () => {
      const tramos: TranscriptSegmentEntry[] = [];
      if (sessionId) {
        tramos.push(...(await listTranscriptSegments(supabase, sessionId)));
      }
      return tramos;
    },
    queryKey: ["voz", "transcript-segments", sessionId],
  });

  const start = useCallback(async () => {
    const sesión = await startListenSession(supabase, { clinicId, consultationId });
    setSessionId(sesión.id);
    const deps: TramoDeps = {
      client: supabase,
      clinicId,
      consultationId,
      // SC-028: un cargador por sesión (consulta y ficha se leen una vez).
      cargarContexto: crearCargadorContexto(supabase, consultationId),
      onWritten: () => void queryClient.invalidateQueries({ queryKey: VOZ_QUERY_KEY }),
    };
    const controller = new ListenModeController({
      onState: setState,
      processWindow: (window, result) => procesarTramo(deps, window, result),
      // FR-055 · US6-AC12: el tramo interrumpido se resuelve con su decisión explícita.
      settlePartialWindow: (window, result, decision) =>
        resolverTramoInterrumpido(deps, window, result, decision),
      ...crearEntradas(MODO_REAL, supabase, sesión.id),
    });
    controllerRef.current = controller;
    // FR-025 · US6-AC5: la activación resuelve en cuanto la sesión existe; la captura corre en
    // segundo plano y el botón sigue habilitado para DETENER en cualquier momento. Al terminar
    // (fin natural, interrupción o fallo) la sesión se cierra con su estado terminal (D8).
    void ejecutarEscucha({
      client: supabase,
      controller,
      sessionId: sesión.id,
      onError: (error) =>
        void captureClientError(errorReporter, {
          error,
          operation: "useListenMode.run",
          requestId: makeRequestId(),
        }),
    });
  }, [clinicId, consultationId, queryClient]);

  const stop = useCallback(async (decision: "processed" | "discarded" = "discarded") => {
    // US6-AC12: la decisión del tramo en curso ('processed' | 'discarded') es explícita; el
    // cierre de la sesión lo resuelve el fin del ciclo (arriba) con su estado terminal.
    controllerRef.current?.stop(decision);
  }, []);

  // Salir de la consulta desmonta el hilo que muestra la grabación: la captura no puede seguir viva
  // sin indicador («Escucha siempre visible»), así que se descarta el tramo en curso.
  useEffect(() => () => controllerRef.current?.stop("discarded"), []);

  const confirmFact = useCallback(
    async (factId: string) => {
      setBusyFactId(factId);
      try {
        const entryId = await confirmarHecho({ client: supabase, queryClient }, factId);
        onLandedRef.current?.(entryId);
      } finally {
        setBusyFactId(null);
      }
    },
    [queryClient],
  );

  const discardFact = useCallback(
    async (factId: string) => {
      setBusyFactId(factId);
      try {
        await discardAudioFactDraft(supabase, factId);
        await queryClient.invalidateQueries({ queryKey: VOZ_QUERY_KEY });
      } finally {
        setBusyFactId(null);
      }
    },
    [queryClient],
  );

  const editFact = useCallback(
    async (factId: string, text: string) => {
      setBusyFactId(factId);
      try {
        await editAudioFactDraft(supabase, { factId, text });
        await queryClient.invalidateQueries({ queryKey: VOZ_QUERY_KEY });
      } finally {
        setBusyFactId(null);
      }
    },
    [queryClient],
  );

  return {
    state,
    startedAt,
    modoReal: MODO_REAL,
    facts: factsQuery.data ?? [],
    segments: segmentsQuery.data ?? [],
    isBusy: busyFactId !== null,
    start,
    stop,
    confirmFact,
    discardFact,
    editFact,
  };
}
