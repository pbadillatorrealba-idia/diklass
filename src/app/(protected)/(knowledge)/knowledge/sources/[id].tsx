import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { VisorDocumento } from "@/components/conocimiento/visor-documento";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { QueryState } from "@/components/ui/query-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { getSource, withdrawSource } from "@/features/conocimiento/coleccion-service";
import { invalidateConocimiento } from "@/features/conocimiento/query-cache";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Fuente clínica con su fragmento citado en contexto (FR-007 · US5-AC7) y retiro de la fuente
 * (FR-053 · US5-AC12), atribuido a quien lo realiza (FR-069 · US5-AC13).
 */
export default function KnowledgeSourceScreen() {
  const params = useLocalSearchParams<{ id: string; fragmento?: string }>();
  const documentId = typeof params.id === "string" ? params.id : "";
  const fragmentoParam =
    typeof params.fragmento === "string" ? Number.parseInt(params.fragmento, 10) : Number.NaN;
  const fragmentoCitado = Number.isFinite(fragmentoParam) ? fragmentoParam : null;

  const queryClient = useQueryClient();
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const [status, setStatus] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [confirmandoRetiro, setConfirmandoRetiro] = useState(false);

  const fuenteQuery = useQuery({
    queryKey: ["conocimiento", "source", documentId],
    queryFn: () => getSource(supabase, documentId),
    enabled: documentId !== "",
  });

  // Una lectura con la sesión caducada abre el diálogo, como en la colección (revisión de la
  // PR #30); cualquier otro fallo se reporta y se muestra, nunca queda en «Cargando…».
  const queryError = fuenteQuery.error;
  useEffect(() => {
    if (!queryError) return;
    if (isAuthenticationRequired(queryError)) {
      setAccessState("expired");
      openExpiredDialog();
      return;
    }
    void captureClientError(errorReporter, {
      error: queryError,
      operation: "getSource",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  const retirar = async () => {
    setConfirmandoRetiro(false);
    setIsWithdrawing(true);
    setStatus(null);
    try {
      await withdrawSource(supabase, { documentId });
      setStatus("Fuente retirada de la colección; sus citas previas siguen siendo identificables.");
      // Refresca este visor, la colección y las reconstrucciones que citan la fuente.
      await invalidateConocimiento(queryClient);
    } catch (error) {
      if (isAuthenticationRequired(error)) {
        setAccessState("expired");
        openExpiredDialog();
      } else {
        setStatus(error instanceof Error ? error.message : "No se pudo retirar la fuente.");
        void captureClientError(errorReporter, {
          error,
          operation: "withdrawSource",
          requestId: makeRequestId(),
        });
      }
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <Screen
      title="Base de conocimiento · Fuente clínica"
      back={{ href: "/knowledge/sources", label: "la colección" }}
    >
      <QueryState
        empty={
          // null: no existe, es de otra clínica o su contenido no es legible (getSource).
          <Text testID="fuente-no-encontrada">
            No se encontró la fuente en la colección de tu clínica.
          </Text>
        }
        error={fuenteQuery.error}
        errorMessage="No se pudo leer la fuente."
        isEmpty={documentId === "" || fuenteQuery.data === null}
        // Sin id la consulta no se ejecuta y quedaría pendiente para siempre.
        isPending={documentId !== "" && fuenteQuery.isPending}
        onRetry={() => void fuenteQuery.refetch()}
        testID="fuente"
      >
        {fuenteQuery.data ? (
          <>
            <VisorDocumento fuente={fuenteQuery.data} fragmentoCitado={fragmentoCitado} />
            {fuenteQuery.data.record.status === "available" && !confirmandoRetiro ? (
              <Button
                className="self-start"
                isDisabled={isWithdrawing}
                onPress={() => setConfirmandoRetiro(true)}
                testID="retirar-fuente"
              >
                <ButtonText>
                  {isWithdrawing ? "Retirando…" : "Retirar fuente de la colección"}
                </ButtonText>
              </Button>
            ) : null}
            {fuenteQuery.data.record.status === "available" && confirmandoRetiro ? (
              // El retiro es irreversible (HD3): se confirma en un segundo paso explícito.
              <Callout title="¿Retirar esta fuente?" tone="warning">
                <Text>
                  Dejará de responder consultas nuevas y no puede deshacerse; sus citas previas
                  seguirán siendo identificables.
                </Text>
                <Box className="flex-row gap-3">
                  <Button onPress={() => void retirar()} testID="confirmar-retiro">
                    <ButtonText>Confirmar retiro</ButtonText>
                  </Button>
                  <Button
                    onPress={() => setConfirmandoRetiro(false)}
                    testID="cancelar-retiro"
                    variant="outline"
                  >
                    <ButtonText>Cancelar</ButtonText>
                  </Button>
                </Box>
              </Callout>
            ) : null}
          </>
        ) : null}
      </QueryState>
      {status !== null ? (
        <Text variant="caption" testID="fuente-status">
          {status}
        </Text>
      ) : null}
    </Screen>
  );
}
