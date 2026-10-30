import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { attributionFromRow } from "@/components/clinical/attribution-from-row";
import { CorrectionHistory } from "@/components/clinical/correction-history";
import { initialActiveSection, type SectionNumber } from "@/components/registro/active-section";
import { type AnamnesisEntryView, AnamnesisSection } from "@/components/registro/anamnesis-section";
import { ConsultationHeader } from "@/components/registro/consultation-header";
import { type DiagnosisEntryView, DiagnosisSection } from "@/components/registro/diagnosis-section";
import { epicrisisChanges } from "@/components/registro/epicrisis-changes";
import { EpicrisisSection } from "@/components/registro/epicrisis-section";
import { FollowUpSummaryPanel } from "@/components/registro/follow-up-summary";
import {
  notice,
  type OperationStatus,
  operationStatus,
} from "@/components/registro/operation-status";
import {
  buildPlan,
  emptyPlanFormValues,
  type PlanFormValues,
} from "@/components/registro/plan-form";
import { useSignatureMotion } from "@/components/registro/signature-motion";
import {
  type ClinicalGuardOutcome,
  useClinicalGuard,
} from "@/components/registro/use-clinical-guard";
import { useReportQueryError } from "@/components/registro/use-report-query-error";
import { Box } from "@/components/ui/box";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { FormSection } from "@/components/ui/form-section";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ListenLiveStatus } from "@/components/voz/listen-live-status";
import { ListenModeSection } from "@/components/voz/listen-mode-section";
import { usePanelThreads } from "@/features/asistente/panel-threads";
import { flushDraft, useDraftPreserver } from "@/features/clinical/draft-preserver";
import { usePatientContext } from "@/features/conocimiento/use-patient-context";
import {
  type AnamnesisEntry,
  correctProvenance,
  listAnamnesisEntries,
  recordAnamnesisEntry,
} from "@/features/registro/anamnesis-service";
import {
  type ConsultationEntry,
  getConsultation,
  listConsultationsByPatient,
  listPatientTimeline,
  resumeConsultation,
} from "@/features/registro/consultation-service";
import {
  type DiagnosisEntry,
  listDiagnoses,
  recordDiagnosis,
} from "@/features/registro/diagnosis-service";
import {
  approveEpicrisis,
  correctEpicrisis,
  type EpicrisisEntry,
  generateEpicrisisDraft,
  listEpicrisisByConsultation,
  updateEpicrisisDraft,
} from "@/features/registro/epicrisis-service";
import { getPatient } from "@/features/registro/ficha-service";
import { invalidateRegistro } from "@/features/registro/query-cache";
import {
  type AnamnesisField,
  anamnesisContentSchema,
  diagnosisContentSchema,
  type EpicrisisContent,
  type Provenance,
} from "@/features/registro/schema";
import { buildFollowUpSummary, effectiveEpicrisis } from "@/features/registro/summaries";
import { getTutor, tutorFullName } from "@/features/registro/tutor-service";
import { keepLanding, type Landing, landAt } from "@/features/voz/landing-mark";
import { useListenMode } from "@/features/voz/use-listen-mode";
import type { Attribution } from "@/lib/attribution/types";
import { getFieldErrors } from "@/lib/forms/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import type { ConsultationDraft } from "@/lib/storage/drafts";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { isUuid } from "@/lib/uuid";
import { useSessionStore } from "@/stores/session-store";
import { useThemeColors } from "@/theme/use-theme-colors";

/** Encabezado del formulario (D20): solo datos que ya existen, leídos por id. */
type HeaderData = { patientName: string; tutorName: string | null; ordinal: number | null };

type WorkspaceData = {
  consultation: ConsultationEntry;
  header: HeaderData;
  anamnesis: AnamnesisEntry[];
  diagnoses: DiagnosisEntry[];
  epicrisisRows: EpicrisisEntry[];
  isClosed: boolean;
};

/**
 * Carga el contenido íntegro de la consulta por el camino de retoma (FR-045 · US4-AC5):
 * `resumeConsultation` devuelve una consulta no cerrada tal como quedó al interrumpirse;
 * solo si no es retomable (cerrada o inexistente) se leen las listas de la consulta.
 */
async function loadHeader(consultation: ConsultationEntry): Promise<HeaderData> {
  const { patientId } = consultation.content;
  const [patient, consultations] = await Promise.all([
    getPatient(supabase, patientId),
    listConsultationsByPatient(supabase, patientId),
  ]);
  const tutor = patient ? await getTutor(supabase, patient.content.tutorId) : null;
  const position = consultations.findIndex((entry) => entry.record.id === consultation.record.id);
  return {
    patientName: patient?.content.name ?? "Paciente no disponible",
    tutorName: tutor ? tutorFullName(tutor.content) : null,
    ordinal: position < 0 ? null : position + 1,
  };
}

async function loadWorkspace(consultationId: string): Promise<WorkspaceData | null> {
  if (!isUuid(consultationId)) return null;
  const resumed = await resumeConsultation(supabase, consultationId);
  if (resumed) {
    return {
      consultation: resumed.consultation,
      header: await loadHeader(resumed.consultation),
      anamnesis: resumed.anamnesis,
      diagnoses: resumed.diagnoses,
      epicrisisRows: resumed.epicrisisDraft ? [resumed.epicrisisDraft] : [],
      isClosed: false,
    };
  }
  const consultation = await getConsultation(supabase, consultationId);
  if (!consultation) {
    return null;
  }
  const [anamnesis, diagnoses, epicrisisRows, header] = await Promise.all([
    listAnamnesisEntries(supabase, consultationId),
    listDiagnoses(supabase, consultationId),
    listEpicrisisByConsultation(supabase, consultationId),
    loadHeader(consultation),
  ]);
  return {
    consultation,
    header,
    anamnesis,
    diagnoses,
    epicrisisRows,
    isClosed: consultation.content.status === "closed",
  };
}

export default function ConsultationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const consultationId = String(id);
  const veterinarianId = useSessionStore((state) => state.veterinarianId);
  const clinicId = useSessionStore((state) => state.clinicId);
  const accessState = useSessionStore((state) => state.accessState);
  const guard = useClinicalGuard();
  const queryClient = useQueryClient();

  const [composerField, setComposerField] = useState<AnamnesisField>("motivo_consulta");
  const [composerText, setComposerText] = useState("");
  const [composerProvenance, setComposerProvenance] = useState<Provenance>("reportada");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [planValues, setPlanValues] = useState<PlanFormValues>(emptyPlanFormValues);
  const [planError, setPlanError] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<{
    sourceId: string;
    content: EpicrisisContent;
  } | null>(null);
  const [draft, setDraft] = useState<ConsultationDraft | null>(null);
  const [status, setStatus] = useState<OperationStatus | null>(null);
  // Borrador confirmado que acaba de aterrizar en la anamnesis (design.md D9): se marca «Nuevo»
  // hasta la siguiente acción, que deja otro estado de operación.
  const [landing, setLanding] = useState<Landing | null>(null);
  useEffect(() => setLanding((actual) => keepLanding(actual, status)), [status]);
  const [isBusy, setIsBusy] = useState(false);
  // Última sección editada (D20): su banda se marca en `primary` sólido.
  const [editedSection, setEditedSection] = useState<SectionNumber | null>(null);
  const colors = useThemeColors();

  const workspaceQuery = useQuery({
    queryKey: ["registro", "consultation-workspace", consultationId],
    queryFn: () => loadWorkspace(consultationId),
  });
  const patientId = workspaceQuery.data?.consultation.content.patientId ?? null;
  // El chat del panel toma al paciente de esta consulta como contexto (FR-026).
  usePatientContext(patientId, workspaceQuery.data?.header.patientName);
  const followUpQuery = useQuery({
    queryKey: ["registro", "consultation-follow-up", patientId ?? "sin-paciente"],
    queryFn: async () => {
      if (patientId === null) {
        throw new Error("El resumen de seguimiento requiere un paciente asociado.");
      }
      const timeline = await listPatientTimeline(supabase, patientId);
      // El resumen sale solo de epicrisis aprobadas de consultas cerradas (FR-013 ·
      // US4-AC1/US4-AC3); la consulta en curso queda fuera del cálculo.
      return buildFollowUpSummary(timeline.history, consultationId);
    },
    enabled: patientId !== null,
  });

  const queryError = workspaceQuery.error ?? followUpQuery.error;
  useReportQueryError(queryError, "load_consultation");

  const handleRestore = useCallback((restored: ConsultationDraft) => {
    setComposerText(restored.notes);
    setStatus(notice("Se recuperó un borrador no guardado de esta consulta."));
  }, []);
  const draftSession = useDraftPreserver({
    veterinarianId,
    consultationId,
    draft,
    isSessionActive: accessState === "active",
    onRestore: handleRestore,
  });

  const data = workspaceQuery.data ?? null;

  // Una sola captura por consulta, compartida por el hilo, el riel y la cinta (design.md D3). Solo
  // con la consulta abierta: sin id el hook no consulta ni inicia sesiones.
  const listenMode = useListenMode(data && !data.isClosed ? consultationId : "", (entryId) => {
    // El anuncio va en `consultation-status` (región `polite`) para los lectores de pantalla.
    const anuncio = notice("Antecedente incorporado a la anamnesis.");
    setStatus(anuncio);
    setLanding(landAt(entryId, anuncio));
  });
  usePanelThreads(
    data && !data.isClosed
      ? [
          {
            id: "escucha",
            label: "Escucha",
            icon: "microphone-outline",
            element: <ListenModeSection modo={listenMode} />,
            status: (variant) => <ListenLiveStatus modo={listenMode} variant={variant} />,
            pending: listenMode.facts.filter((fact) => fact.content.confirmationState === "pending")
              .length,
          },
        ]
      : [],
  );
  const draftEntry =
    data === null
      ? null
      : (data.epicrisisRows.filter((entry) => entry.record.status === "draft").at(-1) ?? null);
  const effectiveRow =
    data === null
      ? null
      : effectiveEpicrisis(
          data.epicrisisRows.map((entry) => entry.record),
          consultationId,
        );
  const effectiveEntry =
    data === null || effectiveRow === null
      ? null
      : (data.epicrisisRows.find((entry) => entry.record.id === effectiveRow.id) ?? null);
  // Versiones firmadas en orden de creación (`listEpicrisisByConsultation` ordena por
  // `created_at`): la efectiva corrige a la que la precede en la cadena.
  const signedChain =
    data === null
      ? []
      : data.epicrisisRows.filter(
          (entry) => entry.record.status === "approved" || entry.record.status === "corrective",
        );
  const correctionChain: Attribution[] = signedChain.map((entry) =>
    attributionFromRow(entry.record),
  );
  const correctedFrom =
    effectiveEntry?.record.status === "corrective"
      ? (signedChain[signedChain.indexOf(effectiveEntry) - 1] ?? null)
      : null;
  // FR-098 · US18-AC3: renglón por campo cambiado entre la versión corregida y la vigente.
  const epicrisisCorrections =
    effectiveEntry === null || correctedFrom === null
      ? []
      : epicrisisChanges(correctedFrom.content, effectiveEntry.content);
  // La edición en curso vive junto al id del borrador que edita: un refetch del mismo
  // borrador no pisa lo que el veterinario está escribiendo.
  const draftContent =
    draftEntry === null
      ? null
      : draftEdits !== null && draftEdits.sourceId === draftEntry.record.id
        ? draftEdits.content
        : draftEntry.content;
  // Última sección editada o, al cargar, el paso siguiente del protocolo (aclaración de D20).
  const activeSection =
    editedSection ??
    (data === null
      ? null
      : initialActiveSection({ isClosed: data.isClosed, hasDraft: draftEntry !== null }));
  const signature = useSignatureMotion(data !== null && !data.isClosed && draftContent !== null);
  const anamnesisViews: AnamnesisEntryView[] =
    data === null
      ? []
      : data.anamnesis.map((entry) => ({
          id: entry.record.id,
          content: entry.content,
          attribution: attributionFromRow(entry.record),
        }));
  const diagnosisViews: DiagnosisEntryView[] =
    data === null
      ? []
      : data.diagnoses.map((entry) => ({
          id: entry.record.id,
          content: entry.content,
          attribution: attributionFromRow(entry.record),
        }));

  // Tras cada escritura se invalida todo el registro, no solo esta pantalla: la ficha y el
  // historial del paciente también cambian al abrir, registrar o cerrar la consulta.
  const refetchWorkspace = () => invalidateRegistro(queryClient);

  // Resuelve si el borrador llegó de verdad al storage: el usuario merece la verdad y no un
  // «se conservó» de trámite (mismo criterio que la pantalla de la 001).
  const preserveComposer = async (): Promise<boolean> => {
    if (!draftSession) {
      return true;
    }
    draftSession.edit({ notes: composerText, updatedAt: new Date().toISOString() });
    return flushDraft(draftSession);
  };

  const handleComposerTextChange = (text: string) => {
    setLanding(null);
    setComposerText(text);
    setDraft({ notes: text, updatedAt: new Date().toISOString() });
  };

  // Operación clínica con su estado: deshabilita la pantalla mientras corre y deja el mensaje según
  // el desenlace. `action` devuelve la atribución del registro, que solo acompaña al éxito.
  const run = async (
    operation: string,
    // biome-ignore lint/suspicious/noConfusingVoidType: las acciones sin atribución no devuelven nada
    action: () => Promise<Attribution | void>,
    success: string,
    failure: string,
  ): Promise<ClinicalGuardOutcome> => {
    setIsBusy(true);
    let attribution: Attribution | null = null;
    const outcome = await guard(operation, async () => {
      attribution = (await action()) ?? null;
    });
    setIsBusy(false);
    setStatus(operationStatus(outcome, success, failure, attribution));
    return outcome;
  };

  const submitAnamnesis = async () => {
    const parsed = anamnesisContentSchema.safeParse({
      consultationId,
      field: composerField,
      text: composerText,
      provenance: composerProvenance,
    });
    if (!parsed.success) {
      setComposerError(getFieldErrors(parsed.error).text ?? "Este campo es obligatorio.");
      return;
    }
    setComposerError(null);
    if (!clinicId) {
      return;
    }
    setIsBusy(true);
    let attribution: Attribution | null = null;
    const outcome = await guard("record_anamnesis", async () => {
      const result = await recordAnamnesisEntry(supabase, {
        clinicId,
        consultationId,
        field: composerField,
        text: parsed.data.text,
        provenance: composerProvenance,
      });
      attribution = result.attribution;
      try {
        await draftSession?.markSaved();
      } catch (error) {
        // El registro ya está guardado: solo falló limpiar el borrador local.
        void captureClientError(errorReporter, {
          error,
          operation: "clear_draft",
          requestId: makeRequestId(),
        });
      }
      setEditedSection(1);
      setComposerText("");
      setDraft(null);
      await refetchWorkspace();
    });
    setIsBusy(false);
    if (outcome === "ok") {
      setStatus({ text: "Antecedente de anamnesis registrado.", attribution });
      return;
    }
    // Sin sesión o sin red lo escrito sigue en el compositor: se conserva y se dice la verdad.
    const preserved = await preserveComposer();
    const expired = outcome === "expired";
    setStatus(
      notice(
        preserved
          ? `${expired ? "La sesión ya no es válida." : "No pudimos registrar el antecedente."} El borrador se conservó.`
          : expired
            ? "La sesión ya no es válida. No pudimos conservar el borrador: no cierres esta pantalla."
            : "No pudimos registrar el antecedente ni conservar el borrador: no cierres esta pantalla.",
      ),
    );
  };

  const correctAnamnesisProvenance = (entryId: string, provenance: Provenance) =>
    run(
      "correct_anamnesis_provenance",
      async () => {
        await correctProvenance(supabase, entryId, provenance);
        setEditedSection(1);
        await refetchWorkspace();
      },
      "Procedencia corregida. La corrección queda registrada y es recuperable.",
      "No pudimos corregir la procedencia.",
    );

  const submitDiagnosis = async () => {
    const { plan, error: planProblem } = buildPlan(planValues);
    setPlanError(planProblem);
    if (planProblem) {
      return;
    }
    const parsed = diagnosisContentSchema.safeParse({ consultationId, text: diagnosisText, plan });
    if (!parsed.success) {
      setDiagnosisError(getFieldErrors(parsed.error).text ?? "Este campo es obligatorio.");
      return;
    }
    setDiagnosisError(null);
    if (!clinicId) {
      return;
    }
    await run(
      "record_diagnosis",
      async () => {
        const result = await recordDiagnosis(supabase, {
          clinicId,
          consultationId,
          text: parsed.data.text,
          plan: parsed.data.plan,
        });
        setEditedSection(2);
        setDiagnosisText("");
        setPlanValues(emptyPlanFormValues);
        await refetchWorkspace();
        return result.attribution;
      },
      "Diagnóstico registrado.",
      "No pudimos registrar el diagnóstico.",
    );
  };

  const generateDraft = async () => {
    if (!clinicId) {
      return;
    }
    await run(
      "generate_epicrisis_draft",
      async () => {
        const result = await generateEpicrisisDraft(supabase, { clinicId, consultationId });
        setEditedSection(3);
        setDraftEdits(null);
        await refetchWorkspace();
        return result.attribution;
      },
      "Borrador de epicrisis generado. No es un registro definitivo hasta que lo apruebes.",
      "No pudimos generar el borrador.",
    );
  };

  const changeDraftContent = (content: EpicrisisContent) => {
    if (draftEntry !== null) {
      setDraftEdits({ sourceId: draftEntry.record.id, content });
    }
  };

  const saveEpicrisisDraft = async () => {
    if (draftEntry === null || draftContent === null) {
      return;
    }
    await run(
      "update_epicrisis_draft",
      async () => {
        await updateEpicrisisDraft(supabase, draftEntry.record.id, draftContent);
        setEditedSection(3);
        await refetchWorkspace();
      },
      "Borrador guardado. Sigue sin ser un registro definitivo.",
      "No pudimos guardar el borrador.",
    );
  };

  const approveAndClose = async () => {
    if (draftEntry === null || draftContent === null) {
      return;
    }
    await run(
      "approve_epicrisis",
      async () => {
        // US3-AC2: se almacena la versión editada y la RPC aprueba y cierra la consulta en la
        // misma transacción (D4).
        await updateEpicrisisDraft(supabase, draftEntry.record.id, draftContent);
        const result = await approveEpicrisis(supabase, draftEntry.record.id);
        setEditedSection(3);
        // La firma (FR-099): el timbre queda listo para entrar cuando la recarga lo monte.
        signature.prepare();
        try {
          await draftSession?.discard();
        } catch (error) {
          // La consulta ya quedó cerrada: solo falló descartar el borrador local.
          void captureClientError(errorReporter, {
            error,
            operation: "discard_draft",
            requestId: makeRequestId(),
          });
        }
        setDraftEdits(null);
        await refetchWorkspace();
        return result.attribution;
      },
      "Epicrisis aprobada y consulta cerrada en la misma operación.",
      "No pudimos aprobar la epicrisis.",
    );
  };

  const submitCorrection = async (content: EpicrisisContent): Promise<ClinicalGuardOutcome> => {
    if (effectiveEntry === null) {
      return "error";
    }
    return run(
      "correct_epicrisis",
      async () => {
        // La corrección es un registro ADICIONAL que conserva el original (FR-024 · US3-AC4).
        const result = await correctEpicrisis(supabase, effectiveEntry.record.id, content);
        setEditedSection(3);
        await refetchWorkspace();
        return result.attribution;
      },
      "Corrección registrada. La versión original permanece legible.",
      "No pudimos registrar la corrección.",
    );
  };

  return (
    <Screen
      width="wide"
      title="Consulta"
      back={
        patientId
          ? {
              href: `/patients/${patientId}`,
              label: "la ficha",
              crumbs: [
                { href: "/patients", label: "Pacientes" },
                {
                  href: `/patients/${patientId}`,
                  label: data?.header.patientName ?? "Ficha del paciente",
                },
              ],
            }
          : { href: "/patients", label: "Pacientes" }
      }
    >
      {workspaceQuery.isLoading ? (
        <Text testID="consultation-loading">Cargando la consulta…</Text>
      ) : null}
      {workspaceQuery.isSuccess && data === null ? (
        <Text testID="consultation-not-found">No encontramos esta consulta.</Text>
      ) : null}
      {queryError ? (
        <Callout testID="consultation-load-error" tone="error">
          No pudimos cargar la consulta. Vuelve a intentarlo.
        </Callout>
      ) : null}
      {data ? (
        <>
          <ConsultationHeader
            createdAt={data.consultation.record.created_at}
            ordinal={data.header.ordinal}
            patientName={data.header.patientName}
            status={data.isClosed ? "closed" : "open"}
            tutorName={data.header.tutorName}
          />
          {/* Mensajes de las operaciones; el estado de la consulta va en el encabezado (D20). */}
          <View className="flex-row flex-wrap items-baseline gap-x-2">
            <Text accessibilityLiveRegion="polite" testID="consultation-status">
              {status?.text ?? ""}
            </Text>
            {status?.attribution ? (
              <AttributionBadge attribution={status.attribution} inline />
            ) : null}
          </View>
          {/* Una sola columna: el contexto de solo lectura precede al registro (D9). */}
          <Box className="gap-6">
            <VStack className="gap-6" testID="consultation-aside">
              {followUpQuery.data ? <FollowUpSummaryPanel summary={followUpQuery.data} /> : null}
              {data.isClosed && effectiveEntry !== null && correctionChain.length > 0 ? (
                <Card testID="epicrisis-correction-history">
                  <CorrectionHistory entries={correctionChain} />
                </Card>
              ) : null}
            </VStack>
            {/* Un solo eje vertical con las secciones numeradas del protocolo (D20). */}
            <VStack className="gap-6" testID="consultation-main">
              <FormSection active={activeSection === 1} number={1} title="Anamnesis">
                <AnamnesisSection
                  entries={anamnesisViews}
                  field={composerField}
                  isBusy={isBusy}
                  isSealed={data.isClosed}
                  landedEntryId={landing?.entryId ?? null}
                  onCorrectProvenance={(entryId, provenance) =>
                    void correctAnamnesisProvenance(entryId, provenance)
                  }
                  onFieldChange={(next) => {
                    setLanding(null);
                    setComposerField(next);
                  }}
                  onProvenanceChange={setComposerProvenance}
                  onSubmit={() => void submitAnamnesis()}
                  onTextChange={handleComposerTextChange}
                  provenance={composerProvenance}
                  text={composerText}
                  textError={composerError}
                />
              </FormSection>
              <FormSection active={activeSection === 2} number={2} title="Diagnóstico">
                <DiagnosisSection
                  entries={diagnosisViews}
                  isBusy={isBusy}
                  isSealed={data.isClosed}
                  onSubmit={() => void submitDiagnosis()}
                  onTextChange={setDiagnosisText}
                  plan={{ values: planValues, error: planError, onChange: setPlanValues }}
                  text={diagnosisText}
                  textError={diagnosisError}
                />
              </FormSection>
              {/*
               * El contenedor de la sección 3 persiste entre el borrador y la epicrisis firmada: al
               * firmar, su pliego canario se funde a papel (FR-099 · D20).
               */}
              <FormSection
                active={activeSection === 3}
                number={3}
                title="Epicrisis y firma"
                underlay={
                  <Animated.View
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        backgroundColor: colors["suggested-surface"],
                        opacity: signature.paper,
                        pointerEvents: "none",
                      },
                    ]}
                    testID="epicrisis-paper"
                  />
                }
              >
                <EpicrisisSection
                  corrections={epicrisisCorrections}
                  draftContent={draftContent}
                  effectiveEntry={effectiveEntry}
                  isBusy={isBusy}
                  isClosed={data.isClosed}
                  onApprove={() => void approveAndClose()}
                  onDraftChange={changeDraftContent}
                  onGenerate={() => void generateDraft()}
                  onSaveDraft={() => void saveEpicrisisDraft()}
                  onSubmitCorrection={submitCorrection}
                  stampStyle={signature.stampStyle}
                />
              </FormSection>
            </VStack>
          </Box>
        </>
      ) : null}
    </Screen>
  );
}
