import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { Text } from "@/components/ui/text";
import type { AdverseEventReportEntry } from "@/features/retroalimentacion/feedback-summary";
import { ADVERSE_EVENT_SEVERITY_LABELS } from "./labels";

/** Fila de evento adverso dentro de la única FlatList del seguimiento (FR-086). */
export function AdverseEventItem({
  entry,
  superseded = false,
}: {
  entry: AdverseEventReportEntry;
  superseded?: boolean;
}) {
  const registradoEl = new Date(entry.registeredAt).toLocaleString("es-CL");
  if (superseded) {
    return (
      <Box
        className="gap-1 rounded-lg border border-border bg-card p-3"
        testID="adverse-event-superseded-item"
      >
        <Text selectable>
          {ADVERSE_EVENT_SEVERITY_LABELS[entry.event.severity]}: {entry.event.description}
        </Text>
        <Text selectable tone="muted">
          Registrado el {registradoEl} · Consulta {entry.consultationId} · en una versión ya
          corregida; permanece registrado.
        </Text>
      </Box>
    );
  }

  const esGrave = entry.event.severity === "grave";
  return (
    <Box
      accessibilityLabel={esGrave ? `Evento adverso grave: ${entry.event.description}` : undefined}
      className={`gap-2 rounded-lg border p-3 ${
        esGrave ? "border-destructive bg-destructive-surface" : "border-border bg-card"
      }`}
      testID="adverse-event-item"
    >
      <SeverityBadge level={entry.event.severity} />
      <Text selectable variant={esGrave ? "strong" : "body"}>
        {entry.event.description}
      </Text>
      <Text selectable tone="muted">
        Registrado el {registradoEl} · Consulta {entry.consultationId}
      </Text>
    </Box>
  );
}

export function AdverseEventToggle({
  count,
  onPress,
  shown,
}: {
  count: number;
  onPress: () => void;
  shown: boolean;
}) {
  return (
    <Button
      accessibilityLabel={
        shown
          ? "Ocultar los eventos de versiones ya corregidas"
          : "Mostrar los eventos de versiones ya corregidas"
      }
      onPress={onPress}
      testID="adverse-event-toggle-superseded"
      variant="outline"
    >
      <ButtonText>
        {shown ? "Ocultar versiones ya corregidas" : `Ver ${count} de versiones ya corregidas`}
      </ButtonText>
    </Button>
  );
}
