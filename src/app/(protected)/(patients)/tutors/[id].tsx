import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { PatientsTable } from "@/components/registro/patients-table";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { QueryState } from "@/components/ui/query-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { searchPatients } from "@/features/registro/patient-search";
import { getTutor, tutorFullName } from "@/features/registro/tutor-service";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { isUuid } from "@/lib/uuid";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/** Ficha mínima del tutor: contacto y los pacientes que tiene a su cargo. */
export default function TutorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tutorId = String(id);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);

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

  const tutor = tutorQuery.data;
  const patients = patientsQuery.data?.rows ?? [];
  const total = patientsQuery.data?.total ?? 0;

  return (
    <Screen back={{ href: "/patients", label: "Pacientes" }} title="Tutor" width="wide">
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
            <Card className="gap-2" testID="tutor-card">
              <Heading level={2}>{tutorFullName(tutor.content)}</Heading>
              {tutor.content.phone ? <Text selectable>Teléfono: {tutor.content.phone}</Text> : null}
              {tutor.content.email ? <Text selectable>Correo: {tutor.content.email}</Text> : null}
              {tutor.content.address || tutor.content.city ? (
                <Text selectable>
                  Dirección:{" "}
                  {[tutor.content.address, tutor.content.city].filter(Boolean).join(", ")}
                </Text>
              ) : null}
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
