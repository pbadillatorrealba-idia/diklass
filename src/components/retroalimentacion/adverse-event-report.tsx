import { useState } from "react";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { AdverseEventReportEntry } from "@/features/retroalimentacion/feedback-summary";
import { ADVERSE_EVENT_SEVERITY_LABELS } from "./labels";

/**
 * Eventos adversos recuperados de forma diferenciada del resto de la evolución (FR-041 ·
 * SC-035 · US10-AC2): sección propia, contexto de su entrada y el `grave` destacado. La lista
 * principal es la de las versiones vigentes: una corrección copia los eventos del original, y
 * mostrarlos todos repetiría un único evento grave una vez por versión (revisión de la PR #28).
 * Los de versiones sustituidas siguen recuperables —el 100 % registrado— a demanda y sin resalte.
 */
export function AdverseEventReport({ events }: { events: AdverseEventReportEntry[] }) {
  const [verSustituidos, setVerSustituidos] = useState(false);
  const vigentes = events.filter((entry) => entry.effective);
  const sustituidos = events.filter((entry) => !entry.effective);

  return (
    <Card testID="adverse-event-report">
      <VStack className="gap-2">
        <Heading level={2}>Eventos adversos</Heading>
        {vigentes.length === 0 ? (
          <Text testID="adverse-event-empty">Sin eventos adversos en las versiones vigentes.</Text>
        ) : (
          vigentes.map((entry) => {
            const registradoEl = new Date(entry.registeredAt).toLocaleString("es-CL");
            const esGrave = entry.event.severity === "grave";
            return (
              <Box
                accessibilityLabel={
                  esGrave ? `Evento adverso grave: ${entry.event.description}` : undefined
                }
                className={`gap-2 rounded-lg border p-3 ${
                  esGrave ? "border-destructive bg-destructive-surface" : "border-border bg-card"
                }`}
                key={`${entry.feedbackRecordId}-evento-${entry.eventIndex}`}
                testID="adverse-event-item"
              >
                {/* Nombre, icono y color de la escala única (FR-077); texto en `foreground`. */}
                <SeverityBadge level={entry.event.severity} />
                <Text selectable variant={esGrave ? "strong" : "body"}>
                  {entry.event.description}
                </Text>
                <Text selectable tone="muted">
                  Registrado el {registradoEl} · Consulta {entry.consultationId}
                </Text>
              </Box>
            );
          })
        )}
        {sustituidos.length === 0 ? null : (
          <>
            <Button
              accessibilityLabel={
                verSustituidos
                  ? "Ocultar los eventos de versiones ya corregidas"
                  : "Mostrar los eventos de versiones ya corregidas"
              }
              onPress={() => setVerSustituidos((valor) => !valor)}
              testID="adverse-event-toggle-superseded"
              variant="outline"
            >
              <ButtonText>
                {verSustituidos
                  ? "Ocultar versiones ya corregidas"
                  : `Ver ${sustituidos.length} de versiones ya corregidas`}
              </ButtonText>
            </Button>
            {verSustituidos
              ? sustituidos.map((entry) => (
                  <Box
                    className="rounded-lg border border-border bg-card p-3 gap-1"
                    key={`${entry.feedbackRecordId}-evento-${entry.eventIndex}`}
                    testID="adverse-event-superseded-item"
                  >
                    <Text selectable>
                      {ADVERSE_EVENT_SEVERITY_LABELS[entry.event.severity]}:{" "}
                      {entry.event.description}
                    </Text>
                    <Text selectable tone="muted">
                      Registrado el {new Date(entry.registeredAt).toLocaleString("es-CL")} ·
                      Consulta {entry.consultationId} · en una versión ya corregida; permanece
                      registrado.
                    </Text>
                  </Box>
                ))
              : null}
          </>
        )}
      </VStack>
    </Card>
  );
}
