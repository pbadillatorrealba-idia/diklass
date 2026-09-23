import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { AdverseEventReportEntry } from "@/features/retroalimentacion/feedback-summary";
import { ADVERSE_EVENT_SEVERITY_LABELS } from "./labels";

/**
 * Eventos adversos recuperados de forma diferenciada del resto de la evolución (FR-041 ·
 * SC-035 · US10-AC2): sección propia, contexto de su entrada y el `grave` destacado. Los
 * eventos de versiones sustituidas también quedan — el 100 % registrado es recuperable — con
 * su marca de vigencia.
 */
export function AdverseEventReport({ events }: { events: AdverseEventReportEntry[] }) {
  return (
    <Box className="rounded-xl border border-border bg-white p-4" testID="adverse-event-report">
      <VStack className="gap-2">
        <Heading size="lg">Eventos adversos</Heading>
        {events.length === 0 ? (
          <Text testID="adverse-event-empty">Sin eventos adversos registrados.</Text>
        ) : (
          events.map((entry) => {
            const registradoEl = new Date(entry.registeredAt).toLocaleString("es-CL");
            const esGrave = entry.event.severity === "grave";
            return (
              <Box
                accessibilityLabel={
                  esGrave ? `Evento adverso grave: ${entry.event.description}` : undefined
                }
                className={
                  esGrave
                    ? "rounded-lg border border-red-300 bg-red-50 p-3 gap-1"
                    : "rounded-lg border border-border bg-white p-3 gap-1"
                }
                key={`${entry.feedbackRecordId}-evento-${entry.eventIndex}`}
                testID="adverse-event-item"
              >
                <Text bold={esGrave} className={esGrave ? "text-red-700" : undefined}>
                  {ADVERSE_EVENT_SEVERITY_LABELS[entry.event.severity]}: {entry.event.description}
                </Text>
                <Text className="text-foreground/70">
                  Registrado el {registradoEl} · Consulta {entry.consultationId}
                </Text>
                {entry.effective ? null : (
                  <Text testID="adverse-event-superseded">
                    En una versión ya corregida; permanece registrado.
                  </Text>
                )}
              </Box>
            );
          })
        )}
      </VStack>
    </Box>
  );
}
