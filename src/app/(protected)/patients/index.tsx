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

export default function PatientsScreen() {
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
      operation: "list_patients",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Head>
        <title>Pacientes · Diklass</title>
      </Head>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack className="w-full max-w-[720px] gap-6">
          <Heading size="2xl">Pacientes</Heading>
          <Button
            accessibilityLabel="Registrar paciente"
            onPress={() => router.push("/patients/new")}
            testID="patients-register"
          >
            <ButtonText>Registrar paciente</ButtonText>
          </Button>
          {patientsQuery.isLoading ? (
            <Text testID="patients-loading">Cargando pacientes…</Text>
          ) : null}
          {queryError ? (
            <Text accessibilityLiveRegion="polite" testID="patients-status">
              No pudimos cargar los pacientes. Vuelve a intentarlo.
            </Text>
          ) : null}
          <VStack className="w-full gap-3" testID="patients-list">
            {(patientsQuery.data ?? []).map((entry) => (
              <Box
                className="rounded-xl border border-border bg-card p-4 gap-2"
                key={entry.record.id}
                testID="patient-item"
              >
                <Text bold>{entry.content.name}</Text>
                <Text className="text-foreground/70">
                  {entry.content.species} · {entry.content.breed}
                </Text>
                <Button
                  accessibilityLabel={`Ver ficha de ${entry.content.name}`}
                  onPress={() => router.push(`/patients/${entry.record.id}`)}
                  testID="patient-open"
                >
                  <ButtonText>Ver ficha</ButtonText>
                </Button>
              </Box>
            ))}
            {patientsQuery.isSuccess && (patientsQuery.data ?? []).length === 0 ? (
              <Text testID="patients-empty">Aún no hay pacientes registrados.</Text>
            ) : null}
          </VStack>
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
