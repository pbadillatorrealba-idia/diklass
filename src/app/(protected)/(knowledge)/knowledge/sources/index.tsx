import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useEffect } from "react";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
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
    <Screen
      title="Base de conocimiento · Colección"
      back={{ href: "/knowledge", label: "Conocimiento" }}
    >
      <Text tone="muted" variant="caption">
        Fuentes clínicas disponibles para las consultas. Retirar una fuente la excluye de consultas
        nuevas sin borrarla: las citas previas siguen siendo identificables.
      </Text>

      <Link asChild href="/knowledge/sources/new">
        <Button className="self-start" testID="conocimiento-incorporar">
          <ButtonText>Incorporar fuente clínica</ButtonText>
        </Button>
      </Link>

      {(fuentesQuery.data ?? []).map((fuente) => (
        <Card className="gap-2" key={fuente.record.id}>
          <Text variant="strong">{fuente.content.bibliografia.titulo}</Text>
          <Text tone="muted" variant="caption">
            {fuente.content.bibliografia.autores.join(", ") || "sin autores registrados"} ·
            Licencia: {fuente.content.licencia.tipo}
          </Text>
          <Text
            testID={`fuente-estado-${fuente.record.id}`}
            tone={fuente.record.status === "withdrawn" ? "destructive" : "muted"}
            variant="caption"
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
              <Text tone="muted" variant="caption">
                Retiro de la colección:
              </Text>
              <AttributionBadge
                attribution={{
                  actorId: fuente.record.withdrawn_by,
                  occurredAt: fuente.record.withdrawn_at,
                  action: null,
                }}
              />
            </Box>
          ) : null}
          <Link
            asChild
            href={{ pathname: "/knowledge/sources/[id]", params: { id: fuente.record.id } }}
          >
            <Button
              className="self-start"
              testID={`ver-fuente-${fuente.record.id}`}
              variant="outline"
            >
              <ButtonText>Ver documento</ButtonText>
            </Button>
          </Link>
        </Card>
      ))}
    </Screen>
  );
}
