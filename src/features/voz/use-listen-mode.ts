import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  type AudioFactEntry,
  discardAudioFactDraft,
  editAudioFactDraft,
  listAudioFacts,
} from "@/features/voz/audio-fact-service";
import { SyntheticCaptureSource } from "@/features/voz/capture-source";
import { guionDemo } from "@/features/voz/guion-demo";
import { ListenModeController, type ListenModeState } from "@/features/voz/listen-mode-controller";
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
import { SimulatedTranscriptionAdapter } from "@/features/voz/transcription-port";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";

/**
 * Orquestación del modo de escucha clínica (D2 · D3 · D5 del diseño; FR-014 · FR-015 · FR-016 ·
 * FR-032 · SC-028): activa la sesión de escucha, recorre las ventanas con el adaptador simulado
 * por defecto, persiste cada tramo, extrae borradores con sus señales de contradicción y los
 * deja confirmables antecedente por antecedente. La consulta abierta la exige el servidor
 * (011, US6-AC14) y la confirmación aterriza la anamnesis en el servidor (D5). La lógica vive en
 * `listen-mode-pipeline.ts` (probada con unitarias); este hook solo la conecta con la interfaz.
 */
export type ListenModeApi = {
  state: ListenModeState;
  facts: AudioFactEntry[];
  segments: TranscriptSegmentEntry[];
  isBusy: boolean;
  start: () => Promise<void>;
  stop: (decision?: "processed" | "discarded") => Promise<void>;
  confirmFact: (factId: string) => Promise<void>;
  discardFact: (factId: string) => Promise<void>;
  editFact: (factId: string, text: string) => Promise<void>;
};

export function useListenMode(consultationId: string): ListenModeApi {
  const clinicId = useSessionStore((estado) => estado.clinicId) ?? "";
  const queryClient = useQueryClient();
  const [state, setState] = useState<ListenModeState>("inactivo");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busyFactId, setBusyFactId] = useState<string | null>(null);
  const controllerRef = useRef<ListenModeController | null>(null);

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
      source: new SyntheticCaptureSource({ guion: guionDemo, listenSessionId: sesión.id }),
      transcription: new SimulatedTranscriptionAdapter(guionDemo),
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

  const confirmFact = useCallback(
    async (factId: string) => {
      setBusyFactId(factId);
      try {
        await confirmarHecho({ client: supabase, queryClient }, factId);
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
