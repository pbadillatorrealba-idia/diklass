import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useEffect } from "react";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QueryState } from "@/components/ui/query-state";
import { ScreenList } from "@/components/ui/screen";
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

  const fuentes = fuentesQuery.data ?? [];
  // Sin fuentes, la acción vive en el vacío (US14-AC5): una sola en pantalla.
  const isEmpty = fuentesQuery.isSuccess && fuentes.length === 0;
  const incorporarLink = (
    <Link asChild href="/knowledge/sources/new">
      <Button className="self-start" testID="conocimiento-incorporar">
        <ButtonText>Incorporar fuente clínica</ButtonText>
      </Button>
    </Link>
  );

  return (
    <ScreenList
      back={{ href: "/knowledge", label: "Conocimiento" }}
      // Con error, como en `QueryState`, el aviso tiene precedencia sobre filas antiguas.
      data={queryError ? [] : fuentes}
      empty={
        <QueryState
          empty={
            <Card className="gap-3" testID="fuentes-empty">
              <Text>
                Aún no hay fuentes clínicas en la colección de tu clínica. Incorpora la primera para
                que las consultas tengan respaldo documental.
              </Text>
              {incorporarLink}
            </Card>
          }
          error={queryError}
          errorMessage="No pudimos cargar la colección."
          isEmpty={isEmpty}
          isPending={fuentesQuery.isPending}
          onRetry={() => void fuentesQuery.refetch()}
          testID="fuentes"
        >
          {null}
        </QueryState>
      }
      header={
        <>
          <Text tone="muted" variant="caption">
            Fuentes clínicas disponibles para las consultas. Retirar una fuente la excluye de
            consultas nuevas sin borrarla: las citas previas siguen siendo identificables.
          </Text>
          {isEmpty ? null : incorporarLink}
        </>
      }
      keyExtractor={(fuente) => fuente.record.id}
      renderItem={({ item: fuente }) => (
        <Card className="gap-2">
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
      )}
      testID="fuentes-list"
      title="Base de conocimiento · Colección"
      width="wide"
    />
  );
}
