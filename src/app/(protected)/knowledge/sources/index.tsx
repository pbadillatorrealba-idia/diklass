import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { listSources } from "@/features/conocimiento/coleccion-service";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Colección documental (FR-028, FR-030, FR-069 · US5-AC6/AC9/AC13): cada fuente con su
 * bibliografía, licencia, estado y la atribución de quién y cuándo la incorporó.
 */
export default function KnowledgeCollectionScreen() {
  const router = useRouter();
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const fuentesQuery = useQuery({
    queryKey: ["conocimiento", "sources"],
    queryFn: () => listSources(supabase),
  });

  const queryError = fuentesQuery.error;
  useEffect(() => {
    if (!queryError) return;
    if (isAuthenticationRequired(queryError)) {
      setAccessState("expired");
      openExpiredDialog();
      return;
    }
    void captureClientError(errorReporter, {
      error: queryError,
      operation: "listSources",
      requestId: makeRequestId(),
    });
  }, [queryError, openExpiredDialog, setAccessState]);

  return (
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack className="w-full max-w-[720px] gap-6">
          <Heading size="lg">Base de conocimiento · Colección</Heading>
          <Text className="text-foreground/70 text-sm">
            Fuentes clínicas disponibles para las consultas. Retirar una fuente la excluye de
            consultas nuevas sin borrarla: las citas previas siguen siendo identificables.
          </Text>

          <Button
            className="self-start"
            onPress={() => router.push("/knowledge/sources/new")}
            testID="conocimiento-incorporar"
          >
            <ButtonText>Incorporar fuente clínica</ButtonText>
          </Button>

          {(fuentesQuery.data ?? []).map((fuente) => (
            <VStack
              className="gap-2 rounded-lg border border-border bg-white p-3"
              key={fuente.record.id}
            >
              <Text bold className="text-foreground">
                {fuente.content.bibliografia.titulo}
              </Text>
              <Text className="text-foreground/70 text-sm">
                {fuente.content.bibliografia.autores.join(", ") || "sin autores registrados"} ·
                Licencia: {fuente.content.licencia.tipo}
              </Text>
              <Text
                className={
                  fuente.record.status === "withdrawn"
                    ? "text-destructive text-sm"
                    : "text-foreground/70 text-sm"
                }
                testID={`fuente-estado-${fuente.record.id}`}
              >
                {fuente.record.status === "withdrawn"
                  ? "Fuente retirada de la colección"
                  : "Fuente disponible para consultas"}
              </Text>
              <AttributionBadge
                attribution={{
                  actorId: fuente.record.created_by,
                  occurredAt: fuente.record.created_at,
                  action: null,
                }}
              />
              {fuente.record.status === "withdrawn" &&
              fuente.record.withdrawn_by !== null &&
              fuente.record.withdrawn_at !== null ? (
                <Box className="gap-1">
                  <Text className="text-foreground/70 text-xs">Retiro de la colección:</Text>
                  <AttributionBadge
                    attribution={{
                      actorId: fuente.record.withdrawn_by,
                      occurredAt: fuente.record.withdrawn_at,
                      action: null,
                    }}
                  />
                </Box>
              ) : null}
              <Button
                className="self-start"
                onPress={() =>
                  router.push({
                    pathname: "/knowledge/sources/[id]",
                    params: { id: fuente.record.id },
                  })
                }
                testID={`ver-fuente-${fuente.record.id}`}
              >
                <ButtonText>Ver documento</ButtonText>
              </Button>
            </VStack>
          ))}
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
