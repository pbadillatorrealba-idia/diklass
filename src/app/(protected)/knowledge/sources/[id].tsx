import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { VisorDocumento } from "@/components/conocimiento/visor-documento";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getSource, withdrawSource } from "@/features/conocimiento/coleccion-service";
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

  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const [status, setStatus] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const fuenteQuery = useQuery({
    queryKey: ["conocimiento", "source", documentId],
    queryFn: () => getSource(supabase, documentId),
    enabled: documentId !== "",
  });

  const retirar = async () => {
    setIsWithdrawing(true);
    setStatus(null);
    try {
      await withdrawSource(supabase, { documentId });
      setStatus("Fuente retirada de la colección; sus citas previas siguen siendo identificables.");
      await fuenteQuery.refetch();
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
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack className="w-full max-w-[720px] gap-6">
          <Heading size="lg">Base de conocimiento · Fuente clínica</Heading>
          {fuenteQuery.data ? (
            <>
              <VisorDocumento fuente={fuenteQuery.data} fragmentoCitado={fragmentoCitado} />
              {fuenteQuery.data.record.status === "available" ? (
                <Button
                  className="self-start"
                  isDisabled={isWithdrawing}
                  onPress={() => void retirar()}
                  testID="retirar-fuente"
                >
                  <ButtonText>
                    {isWithdrawing ? "Retirando…" : "Retirar fuente de la colección"}
                  </ButtonText>
                </Button>
              ) : null}
            </>
          ) : (
            <Text className="text-foreground/70 text-sm">Cargando la fuente…</Text>
          )}
          {status !== null ? (
            <Text className="text-foreground text-sm" testID="fuente-status">
              {status}
            </Text>
          ) : null}
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
