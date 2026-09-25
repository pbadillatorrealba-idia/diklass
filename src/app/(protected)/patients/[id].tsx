import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useState } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { AntecedentsPanel } from "@/components/registro/antecedents-panel";
import {
  type FichaField,
  FichaForm,
  type FichaFormValues,
  parseFichaValues,
} from "@/components/registro/ficha-form";
import { MissingFieldsPanel } from "@/components/registro/missing-fields-panel";
import { PatientHistory } from "@/components/registro/patient-history";
import { useClinicalGuard } from "@/components/registro/use-clinical-guard";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
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
  const [status, setStatus] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [fichaValues, setFichaValues] = useState<FichaFormValues | null>(null);
  const [fichaErrors, setFichaErrors] = useState<Record<string, string>>({});

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

  const patient = patientQuery.data;
  const content = patient?.content ?? null;
  const tutor =
    content === null
      ? null
      : ((tutorsQuery.data ?? []).find((entry) => entry.record.id === content.tutorId) ?? null);

  const startEditing = () => {
    if (!content) {
      return;
    }
    setFichaValues({
      name: content.name,
      species: content.species,
      breed: content.breed,
      birthDate: content.birthDate ?? "",
      ageMonths: content.ageMonths === null ? "" : String(content.ageMonths),
      weightKg: content.weightKg === null ? "" : String(content.weightKg),
      sex: content.sex,
      reproductiveStatus: content.reproductiveStatus,
    });
    setFichaErrors({});
    setIsEditing(true);
  };

  const handleSaveFicha = async () => {
    if (!fichaValues || !content) {
      return;
    }
    const parsed = parseFichaValues(fichaValues, content.antecedentes);
    setFichaErrors(parsed.errors);
    const ficha = parsed.value;
    if (!ficha) {
      setStatus("Revisa los campos marcados antes de continuar.");
      return;
    }
    setIsBusy(true);
    const outcome = await guard("update_patient_ficha", async () => {
      await updatePatientFicha(supabase, patientId, ficha);
      await invalidateRegistro(queryClient);
      setIsEditing(false);
    });
    setIsBusy(false);
    if (outcome === "ok") {
      setStatus("Ficha actualizada.");
    } else if (outcome === "expired") {
      setStatus("La sesión ya no es válida.");
    } else {
      setStatus("No pudimos actualizar la ficha.");
    }
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
      setStatus("Antecedente añadido. Los datos previos se conservan.");
      return true;
    }
    setStatus(
      outcome === "expired" ? "La sesión ya no es válida." : "No pudimos añadir el antecedente.",
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
      setStatus("Consulta abierta.");
    } else if (outcome === "expired") {
      setStatus("La sesión ya no es válida.");
    } else {
      setStatus("No pudimos abrir la consulta.");
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flex: 1 }}>
      <Head>
        <title>Ficha de paciente · Diklass</title>
      </Head>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack className="w-full max-w-[720px] gap-6">
          <Heading size="2xl">Ficha del paciente</Heading>
          {patientQuery.isLoading ? (
            <Text testID="patient-detail-loading">Cargando ficha…</Text>
          ) : null}
          {patientQuery.isSuccess && patient === null ? (
            <Text testID="patient-detail-missing">No encontramos esta ficha.</Text>
          ) : null}
          {status ? (
            <Text accessibilityLiveRegion="polite" testID="patient-detail-status">
              {status}
            </Text>
          ) : null}
          {content ? (
            <>
              <VStack
                className="rounded-xl border border-border bg-white p-4 gap-2"
                testID="patient-ficha"
              >
                <Text bold>Ficha de {content.name}</Text>
                <Text>Nombre: {content.name}</Text>
                <Text>Especie: {content.species}</Text>
                <Text>Raza: {content.breed}</Text>
                <Text>Fecha de nacimiento: {content.birthDate ?? "Sin dato"}</Text>
                <Text>Edad (meses): {content.ageMonths ?? "Sin dato"}</Text>
                <Text>Peso (kg): {content.weightKg ?? "Sin dato"}</Text>
                <Text>Sexo: {content.sex}</Text>
                <Text>Estado reproductivo: {content.reproductiveStatus}</Text>
                <Text>
                  Tutor:{" "}
                  {tutor
                    ? `${tutor.content.name} — ${tutor.content.phone ?? tutor.content.email ?? "sin medio de contacto"}`
                    : "Sin tutor asociado"}
                </Text>
              </VStack>
              <MissingFieldsPanel content={content} />
              {isEditing && fichaValues ? (
                <VStack className="w-full gap-4">
                  <FichaForm
                    errors={fichaErrors}
                    isDisabled={isBusy}
                    onChange={(field: FichaField, text: string) =>
                      setFichaValues((prev) => (prev === null ? prev : { ...prev, [field]: text }))
                    }
                    values={fichaValues}
                  />
                  <Button
                    accessibilityLabel="Guardar ficha"
                    isDisabled={isBusy}
                    onPress={() => void handleSaveFicha()}
                    testID="patient-save"
                  >
                    <ButtonText>Guardar ficha</ButtonText>
                  </Button>
                  <Button
                    accessibilityLabel="Cancelar la edición de la ficha"
                    onPress={() => setIsEditing(false)}
                    testID="patient-edit-cancel"
                  >
                    <ButtonText>Cancelar</ButtonText>
                  </Button>
                </VStack>
              ) : (
                <Button
                  accessibilityLabel="Editar ficha"
                  isDisabled={isBusy}
                  onPress={startEditing}
                  testID="patient-edit"
                >
                  <ButtonText>Editar ficha</ButtonText>
                </Button>
              )}
              <AntecedentsPanel content={content} isBusy={isBusy} onAdd={handleAddAntecedent} />
              <PatientHistory
                entries={historyQuery.data ?? []}
                onOpen={(consultationId) => router.push(`/consultations/${consultationId}`)}
              />
              <Button
                accessibilityLabel="Abrir consulta"
                isDisabled={isBusy}
                onPress={() => void handleOpenConsultation()}
                testID="open-consultation"
              >
                <ButtonText>Abrir consulta</ButtonText>
              </Button>
            </>
          ) : null}
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
