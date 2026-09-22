import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { listAnamnesisEntries } from "@/features/registro/anamnesis-service";
import { getConsultation } from "@/features/registro/consultation-service";
import { getPatient } from "@/features/registro/ficha-service";
import {
  type AudioFactEntry,
  confirmAudioFact,
  createAudioFactDrafts,
  discardAudioFactDraft,
  editAudioFactDraft,
  listAudioFacts,
} from "@/features/voz/audio-fact-service";
import { SyntheticCaptureSource } from "@/features/voz/capture-source";
import { type ContextoContradicciones, detectContradictions } from "@/features/voz/contradictions";
import { extractClinicalFacts } from "@/features/voz/extraction";
import { guionDemo } from "@/features/voz/guion-demo";
import { ListenModeController, type ListenModeState } from "@/features/voz/listen-mode-controller";
import { endListenSession, startListenSession } from "@/features/voz/listen-session-service";
import {
  listTranscriptSegments,
  saveTranscriptSegment,
  settleTranscriptSegment,
  type TranscriptSegmentEntry,
} from "@/features/voz/transcript-service";
import {
  type AudioWindow,
  SimulatedTranscriptionAdapter,
  type TranscriptResult,
} from "@/features/voz/transcription-port";
import { supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";

/**
 * Orquestación del modo de escucha clínica (D2 · D3 · D5 del diseño; FR-014 · FR-015 · FR-016 ·
 * FR-032 · SC-028): activa la sesión de escucha, recorre las ventanas con el adaptador simulado
 * por defecto, persiste cada tramo, extrae borradores con sus señales de contradicción y los
 * deja confirmables antecedente por antecedente. La consulta abierta la garantiza el servicio
 * de sesiones (US6-AC14) y la confirmación aterriza la anamnesis en el servidor (D5).
 */
export type ListenModeApi = {
  state: ListenModeState;
  facts: AudioFactEntry[];
  segments: TranscriptSegmentEntry[];
  isBusy: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  confirmFact: (factId: string) => Promise<void>;
  discardFact: (factId: string) => Promise<void>;
  editFact: (factId: string, text: string) => Promise<void>;
};

async function cargarContextoContradicciones(
  consultationId: string,
): Promise<ContextoContradicciones> {
  const facts = await listAudioFacts(supabase, consultationId);
  const anamnesis = await listAnamnesisEntries(supabase, consultationId);
  const consulta = await getConsultation(supabase, consultationId);
  const fichaItems: ContextoContradicciones["ficha"] = [];
  const patientId = consulta?.content.patientId ?? null;
  if (patientId) {
    const ficha = await getPatient(supabase, patientId);
    const antecedentes = ficha?.content.antecedentes ?? null;
    if (antecedentes) {
      for (const group of Object.keys(antecedentes) as Array<keyof typeof antecedentes>) {
        const items = antecedentes[group] ?? [];
        for (const [index, item] of items.entries()) {
          fichaItems.push({
            refId: `${group}-${index}`,
            group,
            text: item.text,
            negation: item.negative,
          });
        }
      }
    }
  }
  return {
    previos: facts.map((fact) => ({
      id: fact.record.id,
      field: fact.content.field,
      text: fact.content.text,
      negation: false,
    })),
    anamnesis: anamnesis.map((entrada) => ({
      id: entrada.record.id,
      field: entrada.content.field,
      text: entrada.content.text,
      negation: false,
    })),
    ficha: fichaItems,
  };
}

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

  const processWindow = useCallback(
    async (window: AudioWindow, result: TranscriptResult) => {
      const tramo = await saveTranscriptSegment(supabase, {
        listenSessionId: window.listenSessionId,
        clinicId,
        seq: window.seq,
        startedAt: window.startedAt,
        endedAt: new Date(Date.parse(window.startedAt) + window.durationMs).toISOString(),
        text: result.text,
        quality: result.quality,
      });
      const propuestas = extractClinicalFacts({ text: result.text, quality: result.quality });
      if (propuestas.length > 0) {
        const contexto = await cargarContextoContradicciones(consultationId);
        const drafts = propuestas.map((propuesta, indice) => {
          const señales = detectContradictions(
            {
              id: `propuesta-${window.seq}-${indice}`,
              field: propuesta.field,
              text: propuesta.text,
              negation: false,
            },
            contexto,
          );
          return { ...propuesta, contradiction: señales[0] ?? null };
        });
        await createAudioFactDrafts(supabase, {
          clinicId,
          consultationId,
          transcriptSegmentId: tramo.id,
          segmentSeq: window.seq,
          segmentText: result.text,
          drafts,
        });
      }
      await settleTranscriptSegment(supabase, {
        segmentId: tramo.id,
        processingState: "processed",
      });
      void queryClient.invalidateQueries({ queryKey: ["voz"] });
    },
    [clinicId, consultationId, queryClient],
  );

  const start = useCallback(async () => {
    const sesión = await startListenSession(supabase, { clinicId, consultationId });
    setSessionId(sesión.id);
    const controller = new ListenModeController({
      onState: setState,
      processWindow,
      settlePartialWindow: async (window, result, decision) => {
        // FR-055 · US6-AC12: el tramo interrumpido se guarda con su decisión explícita.
        const tramo = await saveTranscriptSegment(supabase, {
          listenSessionId: window.listenSessionId,
          clinicId,
          seq: window.seq,
          startedAt: window.startedAt,
          endedAt: new Date(Date.parse(window.startedAt) + window.durationMs).toISOString(),
          text: result.text,
          quality: result.quality,
        });
        await settleTranscriptSegment(supabase, {
          segmentId: tramo.id,
          processingState: decision,
        });
        void queryClient.invalidateQueries({ queryKey: ["voz"] });
      },
      source: new SyntheticCaptureSource({ guion: guionDemo, listenSessionId: sesión.id }),
      transcription: new SimulatedTranscriptionAdapter(guionDemo),
    });
    controllerRef.current = controller;
    await controller.run();
  }, [clinicId, consultationId, processWindow, queryClient]);

  const stop = useCallback(async () => {
    controllerRef.current?.stop("discarded");
    if (sessionId) {
      await endListenSession(supabase, { sessionId, state: "stopped" });
    }
  }, [sessionId]);

  const confirmFact = useCallback(
    async (factId: string) => {
      setBusyFactId(factId);
      try {
        await confirmAudioFact(supabase, factId);
        await queryClient.invalidateQueries({ queryKey: ["voz"] });
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
        await queryClient.invalidateQueries({ queryKey: ["voz"] });
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
        await queryClient.invalidateQueries({ queryKey: ["voz"] });
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
