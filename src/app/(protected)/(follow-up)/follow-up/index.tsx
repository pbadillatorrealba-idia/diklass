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

/**
 * Selector de paciente para el panel de evolución del seguimiento (montaje mínimo de
 * `follow-up/[patientId]`, D10). La entrada de navegación desde `/home` queda como requisito
 * de integración (archivo compartido): esta ruta es alcanzable por URL documentada.
 */
export default function FollowUpIndexScreen() {
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
      operation: "follow_up_list_patients",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  return (
    <Screen title="Seguimiento entre consultas">
      <Text tone="muted">
        Elige un paciente para registrar o revisar su evolución, adherencia y eventos adversos.
      </Text>
      {patientsQuery.isLoading ? <Text testID="follow-up-loading">Cargando pacientes…</Text> : null}
      {queryError ? (
        <Callout testID="follow-up-status" tone="error">
          No pudimos cargar los pacientes. Vuelve a intentarlo.
        </Callout>
      ) : null}
      <VStack className="w-full gap-3" testID="follow-up-patient-list">
        {(patientsQuery.data ?? []).map((entry) => (
          // Como en /patients: en escritorio la acción va a la derecha (design.md D9).
          <Card
            className="gap-2 lg:flex-row lg:items-center lg:justify-between"
            key={entry.record.id}
            testID="follow-up-patient-item"
          >
            <Text variant="strong">{entry.content.name}</Text>
            <Link asChild href={`/follow-up/${entry.record.id}`}>
              <Button
                accessibilityLabel={`Ver el seguimiento de ${entry.content.name}`}
                testID="follow-up-open"
                variant="outline"
              >
                <ButtonText>Ver seguimiento</ButtonText>
              </Button>
            </Link>
          </Card>
        ))}
      </VStack>
    </Screen>
  );
}
