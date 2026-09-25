import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useEffect } from "react";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QueryState } from "@/components/ui/query-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { listPatients } from "@/features/registro/ficha-service";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

export default function PatientsScreen() {
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const patientsQuery = useQuery({
    queryKey: ["registro", "patients"],
    queryFn: () => listPatients(supabase),
  });

  const queryError = patientsQuery.error;
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
      operation: "list_patients",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  const patients = patientsQuery.data ?? [];
  // La acción de alta vive en el vacío cuando no hay pacientes: una sola en pantalla.
  const isEmpty = patientsQuery.isSuccess && patients.length === 0;
  const registerLink = (
    <Link asChild href="/patients/new">
      <Button
        accessibilityLabel="Registrar paciente"
        className="self-start"
        testID="patients-register"
      >
        <ButtonText>Registrar paciente</ButtonText>
      </Button>
    </Link>
  );

  return (
    <Screen title="Pacientes">
      {isEmpty ? null : registerLink}
      <QueryState
        empty={
          <Card className="gap-3" testID="patients-empty">
            <Text>Aún no hay pacientes registrados. Registra el primero para abrir su ficha.</Text>
            {registerLink}
          </Card>
        }
        error={queryError}
        errorMessage="No pudimos cargar los pacientes."
        isEmpty={isEmpty}
        isPending={patientsQuery.isPending}
        onRetry={() => void patientsQuery.refetch()}
        testID="patients"
      >
        <VStack className="w-full gap-3" testID="patients-list">
          {patients.map((entry) => (
            // En escritorio la acción va a la derecha de los datos (design.md D9).
            <Card
              className="gap-2 lg:flex-row lg:items-center lg:justify-between"
              key={entry.record.id}
              testID="patient-item"
            >
              <VStack className="gap-1">
                <Text variant="strong">{entry.content.name}</Text>
                <Text tone="muted">
                  {entry.content.species} · {entry.content.breed}
                </Text>
              </VStack>
              <Link asChild href={`/patients/${entry.record.id}`}>
                <Button
                  accessibilityLabel={`Ver ficha de ${entry.content.name}`}
                  testID="patient-open"
                  variant="outline"
                >
                  <ButtonText>Ver ficha</ButtonText>
                </Button>
              </Link>
            </Card>
          ))}
        </VStack>
      </QueryState>
    </Screen>
  );
}
