import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { FollowUpSummary } from "@/features/registro/summaries";

function SummaryList({ title, items, testID }: { title: string; items: string[]; testID: string }) {
  return (
    <VStack className="gap-1">
      <Text bold>{title}</Text>
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lista de solo render, sin estado por fila; el resumen no fusiona textos iguales y pueden repetirse.
        <Text key={`${item}-${index}`} testID={testID}>
          {item}
        </Text>
      ))}
    </VStack>
  );
}

/**
 * Resumen automático de las consultas previas del paciente (FR-013 · SC-011 ·
 * US4-AC1/US4-AC3): diagnóstico previo, intervenciones, recomendaciones, exámenes y
 * pendientes señalados, sin búsqueda manual en el historial.
 */
export function FollowUpSummaryPanel({ summary }: { summary: FollowUpSummary }) {
  const hasContent = [
    summary.previousDiagnoses,
    summary.interventions,
    summary.recommendations,
    summary.exams,
    summary.pendingItems,
  ].some((items) => items.length > 0);

  return (
    <Box className="rounded-xl border border-border bg-card p-4" testID="follow-up-summary">
      <Text bold>Resumen de consultas previas</Text>
      {hasContent ? (
        <VStack className="gap-3">
          <SummaryList
            items={summary.previousDiagnoses}
            testID="follow-up-diagnosis"
            title="Diagnóstico previo"
          />
          <SummaryList
            items={summary.interventions}
            testID="follow-up-intervention"
            title="Intervenciones propuestas"
          />
          <SummaryList
            items={summary.recommendations}
            testID="follow-up-recommendation"
            title="Recomendaciones al tutor"
          />
          <SummaryList items={summary.exams} testID="follow-up-exam" title="Exámenes solicitados" />
          {summary.pendingItems.length > 0 ? (
            <VStack className="gap-1">
              <Text bold>Pendientes del plan de seguimiento</Text>
              {summary.pendingItems.map((item, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lista de solo render, sin estado por fila; dos pendientes pueden repetir su texto.
                <Text bold key={`${item}-${index}`} testID="follow-up-pending">
                  Pendiente señalado: {item}
                </Text>
              ))}
            </VStack>
          ) : null}
        </VStack>
      ) : (
        <Text testID="follow-up-empty">Sin epicrisis aprobadas previas que resumir.</Text>
      )}
    </Box>
  );
}
