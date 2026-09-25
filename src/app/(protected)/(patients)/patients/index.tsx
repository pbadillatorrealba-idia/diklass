import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useEffect } from "react";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
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

  return (
    <Screen title="Pacientes">
      <Link asChild href="/patients/new">
        <Button accessibilityLabel="Registrar paciente" testID="patients-register">
          <ButtonText>Registrar paciente</ButtonText>
        </Button>
      </Link>
      {patientsQuery.isLoading ? <Text testID="patients-loading">Cargando pacientes…</Text> : null}
      {queryError ? (
        <Callout testID="patients-status" tone="error">
          No pudimos cargar los pacientes. Vuelve a intentarlo.
        </Callout>
      ) : null}
      <VStack className="w-full gap-3" testID="patients-list">
        {(patientsQuery.data ?? []).map((entry) => (
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
        {patientsQuery.isSuccess && (patientsQuery.data ?? []).length === 0 ? (
          <Text testID="patients-empty">Aún no hay pacientes registrados.</Text>
        ) : null}
      </VStack>
    </Screen>
  );
}
