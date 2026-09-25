import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { OptionPicker } from "@/components/registro/option-picker";
import { useClinicalGuard } from "@/components/registro/use-clinical-guard";
import { AdverseEventReport } from "@/components/retroalimentacion/adverse-event-report";
import { FeedbackForm } from "@/components/retroalimentacion/feedback-form";
import { FeedbackTimeline } from "@/components/retroalimentacion/feedback-timeline";
import { ADHERENCE_LABELS, EVOLUTION_LABELS } from "@/components/retroalimentacion/labels";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { listConsultationsByPatient } from "@/features/registro/consultation-service";
import { listEpicrisisByConsultation } from "@/features/registro/epicrisis-service";
import { getPatient } from "@/features/registro/ficha-service";
import { epicrisisContentSchema } from "@/features/registro/schema";
import { effectiveEpicrisis } from "@/features/registro/summaries";
import {
  type AdverseEventFormValue,
  emptyFeedbackFormValues,
  type FeedbackFormValues,
  feedbackFormValuesFromContent,
  parseFeedbackValues,
} from "@/features/retroalimentacion/feedback-form-values";
import {
  correctFeedbackEntry,
  createFeedbackEntry,
  listFeedbackByConsultations,
} from "@/features/retroalimentacion/feedback-service";
import {
  aggregateFeedback,
  buildFeedbackAntecedents,
  buildFeedbackTimeline,
  collectAdverseEvents,
} from "@/features/retroalimentacion/feedback-summary";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Panel de evolución del seguimiento del paciente (US10 en la superficie propia de D10):
 * registro y corrección de retroalimentación sobre consultas cerradas, cronología con
 * atribución, eventos adversos diferenciados (SC-035) y la evolución previa como antecedente
 * (FR-042 · US10-AC6 en esta superficie; su integración en el resumen de la consulta
 * posterior es el requisito de integración de D9).
 */
export default function FollowUpPanelScreen() {
  const { patientId: routePatientId } = useLocalSearchParams<{ patientId: string }>();
  const patientId = String(routePatientId);
  const clinicId = useSessionStore((state) => state.clinicId);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const queryClient = useQueryClient();
  const guard = useClinicalGuard();

  const [selectedConsultationId, setSelectedConsultationId] = useState<string>("");
  const [formValues, setFormValues] = useState<FeedbackFormValues>(emptyFeedbackFormValues);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [correctionTargetId, setCorrectionTargetId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  // `isBusy` solo deshabilita el botón tras el siguiente render: un doble toque llega antes.
  // Lo registrado es inmutable e inborrable (D4), así que el cerrojo es síncrono.
  const guardando = useRef(false);

  const patientQuery = useQuery({
    queryKey: ["registro", "patient", patientId],
    queryFn: () => getPatient(supabase, patientId),
  });
  const consultationsQuery = useQuery({
    queryKey: ["registro", "patient-consultations", patientId],
    queryFn: () => listConsultationsByPatient(supabase, patientId),
  });
  // Las entradas se leen sobre las consultas que ya trajo `consultationsQuery` (revisión de la
  // PR #28): la clave lleva sus ids, así que una consulta nueva o cerrada relee lo suyo.
  const consultationIds = useMemo(
    () => (consultationsQuery.data ?? []).map((entry) => entry.record.id),
    [consultationsQuery.data],
  );
  const feedbackQuery = useQuery({
    queryKey: ["retroalimentacion", "patient-feedback", patientId, consultationIds],
    queryFn: () => listFeedbackByConsultations(supabase, consultationIds),
    enabled: consultationsQuery.isSuccess,
  });
  const epicrisisQuery = useQuery({
    queryKey: ["registro", "epicrisis", selectedConsultationId],
    queryFn: async () => {
      const rows = await listEpicrisisByConsultation(supabase, selectedConsultationId);
      return effectiveEpicrisis(
        rows.map((entry) => entry.record),
        selectedConsultationId,
      );
    },
    enabled: selectedConsultationId !== "",
  });

  const consultas = consultationsQuery.data ?? [];
  const consultasCerradas = consultas.filter((entry) => entry.content.status === "closed");
  const feedback = feedbackQuery.data ?? [];
  const timeline = useMemo(() => buildFeedbackTimeline(feedback), [feedback]);
  const eventosAdversos = useMemo(() => collectAdverseEvents(timeline), [timeline]);
  const antecedentes = useMemo(
    () =>
      buildFeedbackAntecedents({
        timeline,
        consultations: consultas.map((entry) => entry.record),
      }),
    [timeline, consultas],
  );
  const agregados = useMemo(() => aggregateFeedback(timeline), [timeline]);
  const epicrisisIndicada = useMemo(() => {
    const fila = epicrisisQuery.data;
    if (!fila) {
      return null;
    }
    const legible = epicrisisContentSchema.safeParse(fila.content);
    return legible.success ? legible.data : null;
  }, [epicrisisQuery.data]);

  const queryError =
    patientQuery.error ?? consultationsQuery.error ?? feedbackQuery.error ?? epicrisisQuery.error;
  const sesionExpirada = queryError ? isAuthenticationRequired(queryError) : false;
  // Patrón de `follow-up/index.tsx`: la sesión caducada abre su diálogo; el resto se reporta.
  // El aviso de carga se deriva del error vigente, así que desaparece al recuperarse.
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
      operation: "follow_up_panel_load",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  const cambiarCampo = (patch: Partial<FeedbackFormValues>) => {
    setFormValues((prev) => ({ ...prev, ...patch }));
  };
  const cambiarEvento = (index: number, patch: Partial<AdverseEventFormValue>) => {
    setFormValues((prev) => ({
      ...prev,
      adverseEvents: prev.adverseEvents.map((evento, posicion) =>
        posicion === index ? { ...evento, ...patch } : evento,
      ),
    }));
  };
  const agregarEvento = () => {
    setFormValues((prev) => ({
      ...prev,
      adverseEvents: [...prev.adverseEvents, { severity: "leve", description: "" }],
    }));
  };
  const quitarEvento = (index: number) => {
    setFormValues((prev) => ({
      ...prev,
      adverseEvents: prev.adverseEvents.filter((_, posicion) => posicion !== index),
    }));
  };

  const corregirEntrada = (entry: (typeof timeline)[number]) => {
    setCorrectionTargetId(entry.record.id);
    setSelectedConsultationId(entry.content.consultationId);
    setFormValues(feedbackFormValuesFromContent(entry.content));
    setFormErrors({});
    setStatus("Corrigiendo una entrada: la corrección creará un registro nuevo.");
  };

  const cancelarCorreccion = () => {
    setCorrectionTargetId(null);
    setFormValues(emptyFeedbackFormValues);
    setFormErrors({});
    setStatus(null);
  };

  const guardar = async () => {
    if (guardando.current) {
      return;
    }
    if (!clinicId) {
      setStatus("La sesión no tiene una clínica asociada.");
      return;
    }
    const { value, errors } = parseFeedbackValues(formValues, selectedConsultationId);
    if (!value) {
      setFormErrors(errors);
      setStatus("Revisa los campos señalados antes de guardar.");
      return;
    }
    setFormErrors({});
    guardando.current = true;
    setIsBusy(true);
    const desenlace = await guard(
      correctionTargetId === null ? "createFeedbackEntry" : "correctFeedbackEntry",
      async () => {
        if (correctionTargetId === null) {
          await createFeedbackEntry(supabase, { clinicId, content: value });
        } else {
          await correctFeedbackEntry(supabase, correctionTargetId, value);
        }
        await queryClient.invalidateQueries({
          queryKey: ["retroalimentacion", "patient-feedback", patientId],
        });
      },
    );
    guardando.current = false;
    setIsBusy(false);
    if (desenlace === "ok") {
      setCorrectionTargetId(null);
      setFormValues(emptyFeedbackFormValues);
      setStatus("Retroalimentación registrada.");
    } else if (desenlace === "expired") {
      // El diálogo de sesión expirada ya lo abrió el guard; el formulario se conserva tal cual.
      setStatus("La sesión ya no es válida: la evolución NO se registró. Lo escrito se conserva.");
    } else if (desenlace === "error") {
      setStatus("No pudimos registrar la evolución. Vuelve a intentarlo.");
    }
  };

  const opcionesConsulta = consultasCerradas.map((entry) => ({
    value: entry.record.id,
    label: `Consulta del ${new Date(entry.record.created_at).toLocaleString("es-CL")}`,
  }));

  return (
    <Screen>
      <Head>
        <title>Seguimiento del paciente · Diklass</title>
      </Head>
      <Heading level={1}>
        Seguimiento de {patientQuery.data?.content.name ?? "este paciente"}
      </Heading>

      {queryError && !sesionExpirada ? (
        <Text accessibilityLiveRegion="polite" testID="feedback-load-error">
          No pudimos cargar la evolución del paciente. Vuelve a intentarlo.
        </Text>
      ) : null}

      <Card testID="feedback-antecedents">
        <VStack className="gap-2">
          <Heading level={2}>Evolución previa (antecedentes)</Heading>
          {antecedentes.length === 0 ? (
            <Text testID="feedback-antecedents-empty">
              Sin evolución registrada para este paciente.
            </Text>
          ) : (
            antecedentes.map((antecedente) => (
              <Text key={antecedente.feedbackRecordId} testID="feedback-antecedent-item">
                Consulta del{" "}
                {antecedente.consultationDate === null
                  ? "(fecha no disponible)"
                  : new Date(antecedente.consultationDate).toLocaleString("es-CL")}
                , evolución registrada el{" "}
                {new Date(antecedente.registeredAt).toLocaleString("es-CL")}: adherencia{" "}
                {ADHERENCE_LABELS[antecedente.adherence]}, evolución{" "}
                {EVOLUTION_LABELS[antecedente.evolution]}
                {antecedente.revisedDiagnosis === null
                  ? ""
                  : `; cambio de diagnóstico: ${antecedente.revisedDiagnosis}`}
              </Text>
            ))
          )}
          <Text tone="muted">
            Este es el antecedente que el resumen de la consulta posterior integrará cuando se
            extienda `buildFollowUpSummary` (requisito de integración D9).
          </Text>
        </VStack>
      </Card>

      <FeedbackTimeline entries={timeline} onCorrect={corregirEntrada} />
      <AdverseEventReport events={eventosAdversos} />

      <Card testID="feedback-aggregates">
        <VStack className="gap-1">
          <Heading level={2}>Agregado por categoría</Heading>
          <Text testID="feedback-aggregates-total">Entradas vigentes: {agregados.total}</Text>
          <Text testID="feedback-aggregates-detail">
            Adherencia — completa: {agregados.adherence.completa}, parcial:{" "}
            {agregados.adherence.parcial}, ninguna: {agregados.adherence.ninguna}, desconocida:{" "}
            {agregados.adherence.desconocida}. Evolución — mejoría: {agregados.evolution.mejoria},
            mejoría parcial: {agregados.evolution.mejoriaParcial}, sin cambios:{" "}
            {agregados.evolution.sinCambios}, empeoramiento: {agregados.evolution.empeoramiento},
            desconocida: {agregados.evolution.desconocida}. Eventos adversos — leve:{" "}
            {agregados.adverseEvents.leve}, moderado: {agregados.adverseEvents.moderado}, grave:{" "}
            {agregados.adverseEvents.grave}.
          </Text>
        </VStack>
      </Card>

      <Card testID="feedback-register">
        <VStack className="gap-4">
          <Heading level={2}>
            {correctionTargetId === null
              ? "Registrar evolución posterior"
              : "Corregir una entrada registrada"}
          </Heading>
          {consultasCerradas.length === 0 ? (
            <Text testID="feedback-no-closed-consultations">
              La evolución se registra sobre una consulta cerrada: este paciente aún no tiene
              ninguna.
            </Text>
          ) : (
            <>
              <OptionPicker
                isDisabled={isBusy || correctionTargetId !== null}
                label="Consulta a la que se refiere la evolución"
                onChange={(value: string) => setSelectedConsultationId(value)}
                options={opcionesConsulta}
                testID="feedback-consultation-picker"
                value={selectedConsultationId}
              />
              {epicrisisIndicada ? (
                <Box testID="feedback-indicated-treatment">
                  <Text variant="strong">Tratamiento indicado en esa consulta</Text>
                  <Text>
                    Medicamentos aprobados:{" "}
                    {epicrisisIndicada.medicamentosAprobados.length === 0
                      ? "ninguno"
                      : epicrisisIndicada.medicamentosAprobados.join(", ")}
                  </Text>
                  <Text>
                    Intervenciones propuestas:{" "}
                    {epicrisisIndicada.intervencionesPropuestas.length === 0
                      ? "ninguna"
                      : epicrisisIndicada.intervencionesPropuestas.join(", ")}
                  </Text>
                </Box>
              ) : null}
              <FeedbackForm
                errors={formErrors}
                isDisabled={isBusy}
                onAddAdverseEvent={agregarEvento}
                onChange={cambiarCampo}
                onChangeAdverseEvent={cambiarEvento}
                onRemoveAdverseEvent={quitarEvento}
                values={formValues}
              />
              <Button
                accessibilityLabel="Guardar la retroalimentación"
                isDisabled={isBusy || selectedConsultationId === ""}
                onPress={() => void guardar()}
                testID="feedback-submit"
              >
                <ButtonText>
                  {correctionTargetId === null
                    ? "Registrar evolución"
                    : "Guardar corrección (registro nuevo)"}
                </ButtonText>
              </Button>
              {correctionTargetId === null ? null : (
                <Button
                  accessibilityLabel="Cancelar la corrección"
                  isDisabled={isBusy}
                  onPress={cancelarCorreccion}
                  testID="feedback-cancel-correction"
                >
                  <ButtonText>Cancelar corrección</ButtonText>
                </Button>
              )}
            </>
          )}
          {status === null ? null : (
            <Text accessibilityLiveRegion="polite" testID="feedback-status">
              {status}
            </Text>
          )}
        </VStack>
      </Card>
    </Screen>
  );
}
