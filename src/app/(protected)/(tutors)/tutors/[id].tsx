import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { PatientsTable } from "@/components/registro/patients-table";
import {
  parseTutorValues,
  TutorForm,
  type TutorFormValues,
  tutorValuesFromContent,
} from "@/components/registro/tutor-form";
import { useClinicalGuard } from "@/components/registro/use-clinical-guard";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { DataItem } from "@/components/ui/data-item";
import { Heading } from "@/components/ui/heading";
import { QueryState } from "@/components/ui/query-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { searchPatients } from "@/features/registro/patient-search";
import { invalidateRegistro } from "@/features/registro/query-cache";
import { getTutor, tutorFullName, updateTutor } from "@/features/registro/tutor-service";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { isUuid } from "@/lib/uuid";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/** Ficha del tutor: contacto (editable, FR-123) y los pacientes que tiene a su cargo. */
export default function TutorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tutorId = String(id);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const queryClient = useQueryClient();
  const guard = useClinicalGuard();
  const [values, setValues] = useState<TutorFormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const tutorQuery = useQuery({
    queryKey: ["registro", "tutor", tutorId],
    queryFn: () => (isUuid(tutorId) ? getTutor(supabase, tutorId) : null),
  });
  const patientsQuery = useQuery({
    queryKey: ["registro", "patients", { tutorId }],
    queryFn: () => searchPatients(supabase, { tutorId, sort: "name", dir: "asc", page: 1 }),
  });

  const queryError = tutorQuery.error ?? patientsQuery.error;
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
      operation: "tutor_screen",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  // Otro tutor en la misma pantalla no hereda el formulario abierto ni el aviso del anterior.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se reinicia solo al cambiar de tutor
  useEffect(() => {
    setValues(null);
    setStatus(null);
  }, [tutorId]);

  const tutor = tutorQuery.data;

  const save = async () => {
    if (!values) return;
    const parsed = parseTutorValues(values);
    setErrors(parsed.errors ?? {});
    if (!parsed.value) return;
    const content = parsed.value;
    setIsSaving(true);
    const outcome = await guard("update_tutor", async () => {
      await updateTutor(supabase, tutorId, content);
      await invalidateRegistro(queryClient);
    });
    setIsSaving(false);
    if (outcome === "ok") {
      setValues(null);
      setStatus("Tutor actualizado.");
    } else {
      setStatus(
        outcome === "expired"
          ? "La sesión ya no es válida. Regístrate de nuevo para continuar."
          : "No pudimos guardar los cambios. Vuelve a intentarlo.",
      );
    }
  };
  const patients = patientsQuery.data?.rows ?? [];
  const total = patientsQuery.data?.total ?? 0;

  return (
    <Screen back={{ href: "/tutors", label: "Tutores" }} title="Tutor" width="wide">
      <QueryState
        empty={
          <Card testID="tutor-missing">
            <Text>No encontramos a este tutor.</Text>
          </Card>
        }
        error={queryError}
        errorMessage="No pudimos cargar al tutor."
        isEmpty={tutorQuery.isSuccess && !tutor}
        isPending={tutorQuery.isPending || patientsQuery.isPending}
        onRetry={() => {
          void tutorQuery.refetch();
          void patientsQuery.refetch();
        }}
        testID="tutor"
      >
        {tutor ? (
          <>
            <Card className="gap-4" testID="tutor-card">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <Heading level={2}>{tutorFullName(tutor.content)}</Heading>
                {values === null ? (
                  <Button
                    accessibilityLabel="Editar contacto del tutor"
                    onPress={() => {
                      setErrors({});
                      setStatus(null);
                      setValues(tutorValuesFromContent(tutor.content));
                    }}
                    testID="tutor-edit"
                    variant="outline"
                  >
                    <ButtonText>Editar</ButtonText>
                  </Button>
                ) : null}
              </View>
              {status ? (
                <Callout
                  testID="tutor-status"
                  tone={status === "Tutor actualizado." ? "success" : "error"}
                >
                  {status}
                </Callout>
              ) : null}
              {values ? (
                <>
                  <TutorForm
                    errors={errors}
                    isDisabled={isSaving}
                    onChange={(field, text) =>
                      setValues((prev) => (prev === null ? prev : { ...prev, [field]: text }))
                    }
                    values={values}
                  />
                  <View className="flex-row flex-wrap gap-3">
                    <Button
                      accessibilityLabel="Guardar contacto del tutor"
                      isDisabled={isSaving}
                      onPress={() => void save()}
                      testID="tutor-edit-save"
                    >
                      <ButtonText>Guardar</ButtonText>
                    </Button>
                    <Button
                      accessibilityLabel="Cancelar la edición"
                      onPress={() => setValues(null)}
                      testID="tutor-edit-cancel"
                      variant="outline"
                    >
                      <ButtonText>Cancelar</ButtonText>
                    </Button>
                  </View>
                </>
              ) : (
                <View className="w-full flex-row flex-wrap gap-y-4">
                  <DataItem label="Teléfono" value={tutor.content.phone ?? null} />
                  <DataItem label="Correo" value={tutor.content.email ?? null} />
                  <DataItem
                    label="Dirección"
                    value={
                      [tutor.content.address, tutor.content.city, tutor.content.postalCode]
                        .filter(Boolean)
                        .join(", ") || null
                    }
                  />
                </View>
              )}
            </Card>
            <View className="gap-3">
              <Heading level={2}>Pacientes</Heading>
              {patients.length > 0 ? (
                <PatientsTable dir="asc" rows={patients} sort="name" />
              ) : (
                <Text tone="muted">Este tutor aún no tiene pacientes.</Text>
              )}
              {total > patients.length ? (
                <Text tone="muted" testID="tutor-patients-more">
                  Mostrando {patients.length} de {total} pacientes.
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
