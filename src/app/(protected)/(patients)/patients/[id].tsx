import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AntecedentsPanel } from "@/components/registro/antecedents-panel";
import {
  type FichaFormValues,
  fichaValuesFromContent,
  parseFichaValues,
} from "@/components/registro/ficha-form";
import { PatientHistory } from "@/components/registro/patient-history";
import {
  EditableCard,
  HEADER_FIELDS,
  ORIGIN_FIELDS,
  OriginFields,
  PatientHeader,
  REFERRER_FIELDS,
  ReferrerFields,
} from "@/components/registro/patient-record";
import { useClinicalGuard } from "@/components/registro/use-clinical-guard";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout, type CalloutTone } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { DataItem } from "@/components/ui/data-item";
import { Heading } from "@/components/ui/heading";
import { LinkText } from "@/components/ui/link-text";
import { QueryState } from "@/components/ui/query-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { listPatientTimeline, openConsultation } from "@/features/registro/consultation-service";
import {
  addAntecedentItem,
  getPatient,
  updatePatientFicha,
} from "@/features/registro/ficha-service";
import { invalidateRegistro } from "@/features/registro/query-cache";
import type { AntecedentGroup, AntecedentItem } from "@/features/registro/schema";
import { listTutors } from "@/features/registro/tutor-service";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = String(id);
  const router = useRouter();
  const clinicId = useSessionStore((state) => state.clinicId);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const queryClient = useQueryClient();
  const guard = useClinicalGuard();
  const [status, setStatusState] = useState<{ text: string; tone: CalloutTone } | null>(null);
  const setStatus = (text: string, tone: CalloutTone = "info") => setStatusState({ text, tone });
  const [isBusy, setIsBusy] = useState(false);

  const patientQuery = useQuery({
    queryKey: ["registro", "patient", patientId],
    queryFn: () => getPatient(supabase, patientId),
  });
  const tutorsQuery = useQuery({
    queryKey: ["registro", "tutors"],
    queryFn: () => listTutors(supabase),
  });
  const historyQuery = useQuery({
    queryKey: ["registro", "patient-history", patientId],
    // Una sola lectura de las epicrisis de todas las consultas (listPatientTimeline), con la
    // misma lectura tolerante que el resto del registro.
    queryFn: async () => (await listPatientTimeline(supabase, patientId)).history,
    enabled: patientQuery.isSuccess && patientQuery.data !== null,
  });

  const queryError = patientQuery.error ?? tutorsQuery.error ?? historyQuery.error;
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
      operation: "load_patient",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  const history = historyQuery.data ?? [];
  const lastVisitAt =
    history.length === 0 ? null : history.reduce((a, e) => (e.openedAt > a ? e.openedAt : a), "");
  const patient = patientQuery.data;
  const content = patient?.content ?? null;
  const tutor =
    content === null
      ? null
      : ((tutorsQuery.data ?? []).find((entry) => entry.record.id === content.tutorId) ?? null);

  /** Guarda los campos de una card sobre la ficha vigente; `null` si quedó guardada. */
  const handleSaveFicha = async (
    partial: Partial<FichaFormValues>,
  ): Promise<Record<string, string> | null> => {
    if (!content) {
      return {};
    }
    const parsed = parseFichaValues(
      { ...fichaValuesFromContent(content), ...partial },
      content.antecedentes,
    );
    const ficha = parsed.value;
    if (!ficha) {
      setStatus("Revisa los campos marcados antes de continuar.", "warning");
      return parsed.errors;
    }
    setIsBusy(true);
    const outcome = await guard("update_patient_ficha", async () => {
      await updatePatientFicha(supabase, patientId, ficha);
      await invalidateRegistro(queryClient);
    });
    setIsBusy(false);
    if (outcome === "ok") {
      setStatus("Ficha actualizada.", "success");
      return null;
    }
    setStatus(
      outcome === "expired" ? "La sesión ya no es válida." : "No pudimos actualizar la ficha.",
      "error",
    );
    return {};
  };

  const handleAddAntecedent = async (
    group: AntecedentGroup,
    item: AntecedentItem,
  ): Promise<boolean> => {
    setIsBusy(true);
    const outcome = await guard("add_antecedent", async () => {
      await addAntecedentItem(supabase, patientId, group, item);
      await invalidateRegistro(queryClient);
    });
    setIsBusy(false);
    if (outcome === "ok") {
      setStatus("Antecedente añadido. Los datos previos se conservan.", "success");
      return true;
    }
    setStatus(
      outcome === "expired" ? "La sesión ya no es válida." : "No pudimos añadir el antecedente.",
      "error",
    );
    return false;
  };

  const handleOpenConsultation = async () => {
    if (!clinicId) {
      return;
    }
    setIsBusy(true);
    const outcome = await guard("open_consultation", async () => {
      const result = await openConsultation(supabase, { clinicId, patientId });
      await invalidateRegistro(queryClient);
      router.push(`/consultations/${result.record.id}`);
    });
    setIsBusy(false);
    if (outcome === "ok") {
      setStatus("Consulta abierta.", "success");
    } else if (outcome === "expired") {
      setStatus("La sesión ya no es válida.", "error");
    } else {
      setStatus("No pudimos abrir la consulta.", "error");
    }
  };

  return (
    <Screen
      action={
        content ? (
          <Button
            accessibilityLabel="Abrir consulta"
            isDisabled={isBusy}
            onPress={() => void handleOpenConsultation()}
            testID="open-consultation"
          >
            <ButtonText>Abrir consulta</ButtonText>
          </Button>
        ) : null
      }
      back={{ href: "/patients", label: "Pacientes" }}
      title="Ficha del paciente"
      width="wide"
    >
      {status ? (
        <Callout testID="patient-detail-status" tone={status.tone}>
          {status.text}
        </Callout>
      ) : null}
      <QueryState
        empty={<Text testID="patient-detail-missing">No encontramos esta ficha.</Text>}
        error={patientQuery.error}
        errorMessage="No pudimos cargar la ficha."
        isEmpty={patient === null}
        isPending={patientQuery.isPending}
        onRetry={() => void patientQuery.refetch()}
        testID="patient-detail"
      >
        {content ? (
          <VStack className="w-full gap-6" testID="patient-main">
            <EditableCard
              content={content}
              editTestID="patient-edit"
              fields={HEADER_FIELDS}
              isBusy={isBusy}
              onSave={handleSaveFicha}
              testID="patient-ficha"
              label="ficha"
              title={content.name}
            >
              <PatientHeader
                consultationCount={history.length}
                content={content}
                lastVisitAt={lastVisitAt}
              />
            </EditableCard>
            <Card className="gap-3" testID="patient-tutor-card">
              <Heading level={2}>Tutor</Heading>
              {tutor ? (
                <View className="w-full flex-row flex-wrap gap-y-4">
                  <View className="w-full gap-1 sm:w-1/2 lg:w-1/4">
                    <Text tone="muted" variant="label">
                      Nombre
                    </Text>
                    <Link href={`/tutors/${tutor.record.id}`}>
                      <LinkText>{tutor.content.name}</LinkText>
                    </Link>
                  </View>
                  <DataItem
                    label="Contacto"
                    value={tutor.content.phone ?? tutor.content.email ?? null}
                  />
                </View>
              ) : (
                <Text tone="muted">Sin tutor asociado</Text>
              )}
            </Card>
            <EditableCard
              content={content}
              editTestID="patient-edit-origin"
              fields={ORIGIN_FIELDS}
              isBusy={isBusy}
              onSave={handleSaveFicha}
              testID="patient-origin-card"
              title="Procedencia y adopción"
            >
              <OriginFields content={content} />
            </EditableCard>
            <EditableCard
              content={content}
              editTestID="patient-edit-referrer"
              fields={REFERRER_FIELDS}
              isBusy={isBusy}
              onSave={handleSaveFicha}
              testID="patient-referrer-card"
              title="Derivante y seguro"
            >
              <ReferrerFields content={content} />
            </EditableCard>
            <AntecedentsPanel content={content} isBusy={isBusy} onAdd={handleAddAntecedent} />
            <PatientHistory
              entries={history}
              error={historyQuery.error}
              isPending={historyQuery.isPending}
              onRetry={() => void historyQuery.refetch()}
            />
          </VStack>
        ) : null}
      </QueryState>
    </Screen>
  );
}
