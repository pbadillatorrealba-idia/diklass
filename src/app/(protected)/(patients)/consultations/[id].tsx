import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { CorrectionHistory } from "@/components/clinical/correction-history";
import { type AnamnesisEntryView, AnamnesisSection } from "@/components/registro/anamnesis-section";
import { type DiagnosisEntryView, DiagnosisSection } from "@/components/registro/diagnosis-section";
import { EpicrisisFields } from "@/components/registro/epicrisis-fields";
import { FollowUpSummaryPanel } from "@/components/registro/follow-up-summary";
import {
  type ClinicalGuardOutcome,
  useClinicalGuard,
} from "@/components/registro/use-clinical-guard";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Screen } from "@/components/ui/screen";
import { SuggestedBlock } from "@/components/ui/suggested-block";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { flushDraft, useDraftPreserver } from "@/features/clinical/draft-preserver";
import {
  type AnamnesisEntry,
  correctProvenance,
  listAnamnesisEntries,
  recordAnamnesisEntry,
} from "@/features/registro/anamnesis-service";
import {
  type ConsultationEntry,
  getConsultation,
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
import { invalidateRegistro } from "@/features/registro/query-cache";
import {
  type AnamnesisField,
  anamnesisContentSchema,
  diagnosisContentSchema,
  type EpicrisisContent,
  type Provenance,
} from "@/features/registro/schema";
import {
  buildFollowUpSummary,
  type ClinicalRecordRow,
  effectiveEpicrisis,
} from "@/features/registro/summaries";
import type { Attribution } from "@/lib/attribution/types";
import { isAuthenticationRequired } from "@/lib/errors";
import { getFieldErrors } from "@/lib/forms/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import type { ConsultationDraft } from "@/lib/storage/drafts";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

type WorkspaceData = {
  consultation: ConsultationEntry;
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
async function loadWorkspace(consultationId: string): Promise<WorkspaceData | null> {
  const resumed = await resumeConsultation(supabase, consultationId);
  if (resumed) {
    return {
      consultation: resumed.consultation,
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
  const [anamnesis, diagnoses, epicrisisRows] = await Promise.all([
    listAnamnesisEntries(supabase, consultationId),
    listDiagnoses(supabase, consultationId),
    listEpicrisisByConsultation(supabase, consultationId),
  ]);
  return {
    consultation,
    anamnesis,
    diagnoses,
    epicrisisRows,
    isClosed: consultation.content.status === "closed",
  };
}

/**
 * Autor y momento de cada entrada para sus `AttributionBadge` (FR-004 · US2-AC6): son las
 * columnas de atribución que el servidor fija; jamás viajan de vuelta en ningún payload.
 */
function attributionFromRow(record: ClinicalRecordRow): Attribution {
  if (record.status === "approved") {
    return {
      actorId: record.approved_by ?? record.created_by,
      occurredAt: record.approved_at ?? record.created_at,
      action: "epicrisis_approved",
    };
  }
  if (record.status === "corrective") {
    return {
      actorId: record.created_by,
      occurredAt: record.created_at,
      action: "corrective_record_created",
      supersedesEventId: record.supersedes_event_id,
    };
  }
  return { actorId: record.created_by, occurredAt: record.created_at, action: null };
}

function statusMessage(outcome: ClinicalGuardOutcome, success: string, failure: string): string {
  if (outcome === "expired") {
    return "La sesión ya no es válida.";
  }
  return outcome === "error" ? failure : success;
}

export default function ConsultationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const consultationId = String(id);
  const veterinarianId = useSessionStore((state) => state.veterinarianId);
  const clinicId = useSessionStore((state) => state.clinicId);
  const accessState = useSessionStore((state) => state.accessState);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const guard = useClinicalGuard();
  const queryClient = useQueryClient();

  const [composerField, setComposerField] = useState<AnamnesisField>("motivo_consulta");
  const [composerText, setComposerText] = useState("");
  const [composerProvenance, setComposerProvenance] = useState<Provenance>("reportada");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [diagnosisText, setDiagnosisText] = useState("");
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [correctionContent, setCorrectionContent] = useState<EpicrisisContent | null>(null);
  const [draftEdits, setDraftEdits] = useState<{
    sourceId: string;
    content: EpicrisisContent;
  } | null>(null);
  const [draft, setDraft] = useState<ConsultationDraft | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savedAttribution, setSavedAttribution] = useState<Attribution | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const workspaceQuery = useQuery({
    queryKey: ["registro", "consultation-workspace", consultationId],
    queryFn: () => loadWorkspace(consultationId),
  });
  const patientId = workspaceQuery.data?.consultation.content.patientId ?? null;
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
  useEffect(() => {
    if (!queryError) {
      return;
    }
    if (isAuthenticationRequired(queryError)) {
      setAccessState("expired");
      openExpiredDialog();
      return;
    }
    void captureClientError(errorReporter, {
      error: queryError,
      operation: "load_consultation",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  const handleRestore = useCallback((restored: ConsultationDraft) => {
    setComposerText(restored.notes);
    setStatus("Se recuperó un borrador no guardado de esta consulta.");
  }, []);
  const draftSession = useDraftPreserver({
    veterinarianId,
    consultationId,
    draft,
    isSessionActive: accessState === "active",
    onRestore: handleRestore,
  });

  const data = workspaceQuery.data ?? null;
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
  const correctionChain: Attribution[] =
    data === null
      ? []
      : data.epicrisisRows
          .filter(
            (entry) => entry.record.status === "approved" || entry.record.status === "corrective",
          )
          .map((entry) => attributionFromRow(entry.record));
  // La edición en curso vive junto al id del borrador que edita: un refetch del mismo
  // borrador no pisa lo que el veterinario está escribiendo.
  const draftContent =
    draftEntry === null
      ? null
      : draftEdits !== null && draftEdits.sourceId === draftEntry.record.id
        ? draftEdits.content
        : draftEntry.content;
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
    setComposerText(text);
    setDraft({ notes: text, updatedAt: new Date().toISOString() });
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
    if (accessState !== "active") {
      const preserved = await preserveComposer();
      openExpiredDialog();
      setStatus(
        preserved
          ? "La sesión ya no es válida. El borrador se conservó."
          : "La sesión ya no es válida. No pudimos conservar el borrador: no cierres esta pantalla.",
      );
      return;
    }
    setIsBusy(true);
    const requestId = makeRequestId();
    try {
      const result = await recordAnamnesisEntry(supabase, {
        clinicId,
        consultationId,
        field: composerField,
        text: parsed.data.text,
        provenance: composerProvenance,
      });
      try {
        await draftSession?.markSaved();
      } catch (error) {
        // El registro ya está guardado: solo falló limpiar el borrador local.
        void captureClientError(errorReporter, { error, operation: "clear_draft", requestId });
      }
      setSavedAttribution(result.attribution);
      setComposerText("");
      setDraft(null);
      setStatus("Antecedente de anamnesis registrado.");
      await refetchWorkspace();
    } catch (error) {
      const preserved = await preserveComposer();
      if (isAuthenticationRequired(error)) {
        setAccessState("expired");
        openExpiredDialog();
        setStatus(
          preserved
            ? "La sesión ya no es válida. El borrador se conservó."
            : "La sesión ya no es válida. No pudimos conservar el borrador: no cierres esta pantalla.",
        );
      } else {
        void captureClientError(errorReporter, {
          error,
          operation: "record_anamnesis",
          requestId,
        });
        setStatus(
          preserved
            ? "No pudimos registrar el antecedente. El borrador se conservó."
            : "No pudimos registrar el antecedente ni conservar el borrador: no cierres esta pantalla.",
        );
      }
    } finally {
      setIsBusy(false);
    }
  };

  const correctAnamnesisProvenance = async (entryId: string, provenance: Provenance) => {
    setIsBusy(true);
    const outcome = await guard("correct_anamnesis_provenance", async () => {
      await correctProvenance(supabase, entryId, provenance);
      await refetchWorkspace();
    });
    setIsBusy(false);
    setStatus(
      statusMessage(
        outcome,
        "Procedencia corregida. La corrección queda registrada y es recuperable.",
        "No pudimos corregir la procedencia.",
      ),
    );
  };

  const submitDiagnosis = async () => {
    const parsed = diagnosisContentSchema.safeParse({ consultationId, text: diagnosisText });
    if (!parsed.success) {
      setDiagnosisError(getFieldErrors(parsed.error).text ?? "Este campo es obligatorio.");
      return;
    }
    setDiagnosisError(null);
    if (!clinicId) {
      return;
    }
    setIsBusy(true);
    const outcome = await guard("record_diagnosis", async () => {
      const result = await recordDiagnosis(supabase, {
        clinicId,
        consultationId,
        text: parsed.data.text,
      });
      setSavedAttribution(result.attribution);
      setDiagnosisText("");
      await refetchWorkspace();
    });
    setIsBusy(false);
    setStatus(
      statusMessage(outcome, "Diagnóstico registrado.", "No pudimos registrar el diagnóstico."),
    );
  };

  const generateDraft = async () => {
    if (!clinicId) {
      return;
    }
    setIsBusy(true);
    const outcome = await guard("generate_epicrisis_draft", async () => {
      const result = await generateEpicrisisDraft(supabase, { clinicId, consultationId });
      setSavedAttribution(result.attribution);
      setDraftEdits(null);
      await refetchWorkspace();
    });
    setIsBusy(false);
    setStatus(
      statusMessage(
        outcome,
        "Borrador de epicrisis generado. No es un registro definitivo hasta que lo apruebes.",
        "No pudimos generar el borrador.",
      ),
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
    setIsBusy(true);
    const outcome = await guard("update_epicrisis_draft", async () => {
      await updateEpicrisisDraft(supabase, draftEntry.record.id, draftContent);
      await refetchWorkspace();
    });
    setIsBusy(false);
    setStatus(
      statusMessage(
        outcome,
        "Borrador guardado. Sigue sin ser un registro definitivo.",
        "No pudimos guardar el borrador.",
      ),
    );
  };

  const approveAndClose = async () => {
    if (draftEntry === null || draftContent === null) {
      return;
    }
    setIsBusy(true);
    const outcome = await guard("approve_epicrisis", async () => {
      // US3-AC2: se almacena la versión editada y la RPC aprueba y cierra la consulta en la
      // misma transacción (D4).
      await updateEpicrisisDraft(supabase, draftEntry.record.id, draftContent);
      const result = await approveEpicrisis(supabase, draftEntry.record.id);
      setSavedAttribution(result.attribution);
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
    });
    setIsBusy(false);
    setStatus(
      statusMessage(
        outcome,
        "Epicrisis aprobada y consulta cerrada en la misma operación.",
        "No pudimos aprobar la epicrisis.",
      ),
    );
  };

  const submitCorrection = async () => {
    if (effectiveEntry === null || correctionContent === null) {
      return;
    }
    setIsBusy(true);
    const outcome = await guard("correct_epicrisis", async () => {
      // La corrección es un registro ADICIONAL que conserva el original (FR-024 · US3-AC4).
      const result = await correctEpicrisis(supabase, effectiveEntry.record.id, correctionContent);
      setSavedAttribution(result.attribution);
      setCorrectionContent(null);
      await refetchWorkspace();
    });
    setIsBusy(false);
    setStatus(
      statusMessage(
        outcome,
        "Corrección registrada. La versión original permanece legible.",
        "No pudimos registrar la corrección.",
      ),
    );
  };

  return (
    <Screen
      width="wide"
      title="Consulta"
      back={
        patientId
          ? { href: `/patients/${patientId}`, label: "la ficha" }
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
          <Text accessibilityLiveRegion="polite" testID="consultation-status">
            {status ?? (data.isClosed ? "Consulta cerrada." : "Consulta abierta.")}
          </Text>
          {savedAttribution ? <AttributionBadge attribution={savedAttribution} /> : null}
          <Link asChild href={`/patients/${data.consultation.content.patientId}`}>
            <Button
              accessibilityLabel="Ver ficha del paciente"
              className="self-start"
              testID="consultation-patient"
              variant="outline"
            >
              <ButtonText>Ver ficha del paciente</ButtonText>
            </Button>
          </Link>
          {/*
           * Dos columnas desde `lg` (design.md D9): el contexto de solo lectura va primero en el
           * DOM —como en móvil, donde precede a la anamnesis— y a la derecha en escritorio. Al no
           * tener controles, no altera el orden de foco del registro.
           */}
          <Box className="gap-6 lg:flex-row-reverse lg:items-start">
            <VStack className="gap-6 lg:w-2/5" testID="consultation-aside">
              {followUpQuery.data ? <FollowUpSummaryPanel summary={followUpQuery.data} /> : null}
              {data.isClosed && effectiveEntry !== null && correctionChain.length > 0 ? (
                <Card testID="epicrisis-correction-history">
                  <CorrectionHistory entries={correctionChain} />
                </Card>
              ) : null}
            </VStack>
            <VStack className="gap-6 lg:flex-1" testID="consultation-main">
              <AnamnesisSection
                entries={anamnesisViews}
                field={composerField}
                isBusy={isBusy}
                isSealed={data.isClosed}
                onCorrectProvenance={(entryId, provenance) =>
                  void correctAnamnesisProvenance(entryId, provenance)
                }
                onFieldChange={setComposerField}
                onProvenanceChange={setComposerProvenance}
                onSubmit={() => void submitAnamnesis()}
                onTextChange={handleComposerTextChange}
                provenance={composerProvenance}
                text={composerText}
                textError={composerError}
              />
              <DiagnosisSection
                entries={diagnosisViews}
                isBusy={isBusy}
                isSealed={data.isClosed}
                onSubmit={() => void submitDiagnosis()}
                onTextChange={setDiagnosisText}
                text={diagnosisText}
                textError={diagnosisError}
              />
              <VStack className="w-full gap-4" testID="epicrisis-section">
                <Heading level={2}>Epicrisis</Heading>
                {data.isClosed ? (
                  effectiveEntry === null ? (
                    <Text testID="epicrisis-empty">Sin epicrisis aprobada para esta consulta.</Text>
                  ) : (
                    <>
                      <Card className="gap-2" testID="epicrisis-effective">
                        <Text variant="strong">Epicrisis efectiva — registro definitivo</Text>
                        {effectiveEntry.record.status === "corrective" ? (
                          <Text>
                            Corrige una versión anterior, que permanece registrada y recuperable.
                          </Text>
                        ) : null}
                        <AttributionBadge attribution={attributionFromRow(effectiveEntry.record)} />
                      </Card>
                      <EpicrisisFields content={effectiveEntry.content} isEditable={false} />
                      {correctionContent === null ? (
                        <Button
                          accessibilityLabel="Corregir epicrisis"
                          isDisabled={isBusy}
                          onPress={() => setCorrectionContent(effectiveEntry.content)}
                          testID="epicrisis-correct"
                        >
                          <ButtonText>Corregir epicrisis</ButtonText>
                        </Button>
                      ) : (
                        <VStack className="w-full gap-4">
                          <Text variant="strong">Corrección de la epicrisis</Text>
                          <Text tone="muted">
                            La corrección crea un registro adicional: la versión original permanece
                            legible e intocable.
                          </Text>
                          <EpicrisisFields
                            content={correctionContent}
                            isEditable
                            onChange={setCorrectionContent}
                          />
                          <Button
                            accessibilityLabel="Guardar corrección de la epicrisis"
                            isDisabled={isBusy}
                            onPress={() => void submitCorrection()}
                            testID="epicrisis-correct-save"
                          >
                            <ButtonText>Guardar corrección</ButtonText>
                          </Button>
                          <Button
                            accessibilityLabel="Cancelar la corrección"
                            isDisabled={isBusy}
                            onPress={() => setCorrectionContent(null)}
                            testID="epicrisis-correct-cancel"
                            variant="outline"
                          >
                            <ButtonText>Cancelar</ButtonText>
                          </Button>
                        </VStack>
                      )}
                    </>
                  )
                ) : draftEntry === null ? (
                  <>
                    <Text tone="muted">
                      El borrador se arma con lo registrado en la sesión y en la ficha. No forma
                      parte del historial clínico hasta que lo apruebes.
                    </Text>
                    <Button
                      accessibilityLabel="Generar borrador de epicrisis"
                      isDisabled={isBusy}
                      onPress={() => void generateDraft()}
                      testID="epicrisis-generate"
                    >
                      <ButtonText>Generar borrador</ButtonText>
                    </Button>
                  </>
                ) : draftContent === null ? null : (
                  <>
                    {/* Lo arma el sistema y no está validado (FR-076). */}
                    <SuggestedBlock testID="consultation-draft-label">
                      <Text variant="strong">Borrador de epicrisis</Text>
                      <Text tone="muted">
                        No es un registro definitivo: nada entra al historial sin tu validación
                        explícita.
                      </Text>
                    </SuggestedBlock>
                    <EpicrisisFields
                      content={draftContent}
                      isEditable
                      onChange={changeDraftContent}
                    />
                    <Button
                      accessibilityLabel="Guardar borrador de epicrisis"
                      isDisabled={isBusy}
                      onPress={() => void saveEpicrisisDraft()}
                      testID="epicrisis-save-draft"
                      variant="outline"
                    >
                      <ButtonText>Guardar borrador</ButtonText>
                    </Button>
                    <Button
                      accessibilityLabel="Aprobar y cerrar consulta"
                      isDisabled={isBusy}
                      onPress={() => void approveAndClose()}
                      testID="epicrisis-approve"
                    >
                      <ButtonText>Aprobar y cerrar consulta</ButtonText>
                    </Button>
                  </>
                )}
              </VStack>
            </VStack>
          </Box>
        </>
      ) : null}
    </Screen>
  );
}
