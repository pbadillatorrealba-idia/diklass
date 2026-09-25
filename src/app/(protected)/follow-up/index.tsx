import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { useEffect } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
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
  const router = useRouter();
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
    <SafeAreaView style={{ flex: 1 }}>
      <Head>
        <title>Seguimiento · Diklass</title>
      </Head>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack className="w-full max-w-[720px] gap-6">
          <Heading size="2xl">Seguimiento entre consultas</Heading>
          <Text className="text-foreground/70">
            Elige un paciente para registrar o revisar su evolución, adherencia y eventos adversos.
          </Text>
          {patientsQuery.isLoading ? (
            <Text testID="follow-up-loading">Cargando pacientes…</Text>
          ) : null}
          {queryError ? (
            <Text accessibilityLiveRegion="polite" testID="follow-up-status">
              No pudimos cargar los pacientes. Vuelve a intentarlo.
            </Text>
          ) : null}
          <VStack className="w-full gap-3" testID="follow-up-patient-list">
            {(patientsQuery.data ?? []).map((entry) => (
              <Box
                className="rounded-xl border border-border bg-card p-4 gap-2"
                key={entry.record.id}
                testID="follow-up-patient-item"
              >
                <Text bold>{entry.content.name}</Text>
                <Button
                  accessibilityLabel={`Ver el seguimiento de ${entry.content.name}`}
                  onPress={() => router.push(`/follow-up/${entry.record.id}`)}
                  testID="follow-up-open"
                >
                  <ButtonText>Ver seguimiento</ButtonText>
                </Button>
              </Box>
            ))}
          </VStack>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
