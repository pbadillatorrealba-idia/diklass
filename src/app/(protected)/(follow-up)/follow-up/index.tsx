import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useEffect } from "react";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LinkText } from "@/components/ui/link-text";
import { QueryState } from "@/components/ui/query-state";
import { ScreenList } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
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
    <ScreenList
      // Con error, como en `QueryState`, el aviso tiene precedencia sobre filas antiguas.
      data={queryError ? [] : (patientsQuery.data ?? [])}
      empty={
        <QueryState
          empty={
            <Card className="gap-3" testID="follow-up-empty">
              <Text>
                Aún no hay pacientes registrados. El seguimiento empieza cuando registras al
                primero.
              </Text>
              <Link asChild href="/patients/new">
                <LinkText>Registrar paciente</LinkText>
              </Link>
            </Card>
          }
          error={queryError}
          errorMessage="No pudimos cargar los pacientes."
          isEmpty={patientsQuery.isSuccess && patientsQuery.data.length === 0}
          isPending={patientsQuery.isPending}
          onRetry={() => void patientsQuery.refetch()}
          testID="follow-up"
        >
          {null}
        </QueryState>
      }
      header={
        <Text tone="muted">
          Elige un paciente para registrar o revisar su evolución, adherencia y eventos adversos.
        </Text>
      }
      keyExtractor={(entry) => entry.record.id}
      renderItem={({ item: entry }) => (
        // Como en /patients: en escritorio la acción va a la derecha (design.md D9).
        <Card
          className="gap-2 lg:flex-row lg:items-center lg:justify-between"
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
      )}
      testID="follow-up-patient-list"
      title="Seguimiento entre consultas"
    />
  );
}
