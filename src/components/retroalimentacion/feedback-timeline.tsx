// biome-ignore-all lint/suspicious/noArrayIndexKey: filas de solo render de eventos adversos; la lista de una entrada registrada no muta.

import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { CorrectionHistory } from "@/components/clinical/correction-history";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { FeedbackTimelineEntry } from "@/features/retroalimentacion/feedback-summary";
import type { Attribution } from "@/lib/attribution/types";
import { ADHERENCE_LABELS, ADVERSE_EVENT_SEVERITY_LABELS, EVOLUTION_LABELS } from "./labels";

function attributionDe(entry: FeedbackTimelineEntry): Attribution {
  return {
    actorId: entry.record.created_by,
    occurredAt: entry.record.created_at,
    action:
      entry.correctsRecordId === null ? "clinical_feedback_recorded" : "corrective_record_created",
    supersedesEventId: entry.record.supersedes_event_id,
  };
}

type FeedbackTimelineProps = {
  entries: FeedbackTimelineEntry[];
  onCorrect: (entry: FeedbackTimelineEntry) => void;
};

/**
 * Cronología de las entradas de retroalimentación de un paciente (FR-056 · US10-AC11): todas
 * las entradas en orden cronológico, cada corrección como registro nuevo visible junto al
 * original que permanece (FR-024 · US10-AC5) y atribución de autor y momento (FR-070). El
 * `grave` de un evento adverso se destaca para no diluirse (FR-041 · US10-AC2).
 */
export function FeedbackTimeline({ entries, onCorrect }: FeedbackTimelineProps) {
  return (
    <VStack className="w-full gap-3" testID="feedback-timeline">
      <Heading size="lg">Evolución registrada</Heading>
      {entries.length === 0 ? (
        <Text testID="feedback-timeline-empty">
          Sin retroalimentación registrada para este paciente.
        </Text>
      ) : (
        entries.map((entry) => {
          const registradoEl = new Date(entry.record.created_at).toLocaleString("es-CL");
          const correcciones = entries.filter(
            (candidata) => candidata.correctsRecordId === entry.record.id,
          );
          return (
            <Box
              className="rounded-xl border border-border bg-white p-4 gap-2"
              key={entry.record.id}
              testID="feedback-timeline-item"
            >
              <Text bold testID="feedback-timeline-registered-at">
                Entrada registrada el {registradoEl}
              </Text>
              <Text>
                Consulta referida: {entry.content.consultationId} · Registrado el {registradoEl}
              </Text>
              {entry.correctsRecordId !== null ? (
                <Text testID="feedback-correction-mark">Corrección (registro nuevo)</Text>
              ) : null}
              {entry.supersededByRecordId !== null ? (
                <Text testID="feedback-superseded-mark">
                  Corregida después: esta versión permanece registrada.
                </Text>
              ) : null}
              {entry.effective ? (
                <Text testID="feedback-effective-mark">Versión vigente</Text>
              ) : null}

              <Text>Adherencia: {ADHERENCE_LABELS[entry.content.adherence]}</Text>
              <Text>Evolución: {EVOLUTION_LABELS[entry.content.evolution]}</Text>
              {entry.content.evolutionNote !== null ? (
                <Text testID="feedback-timeline-evolution-note">{entry.content.evolutionNote}</Text>
              ) : null}
              <Text testID="feedback-timeline-treatment-applied">
                Tratamiento aplicado:{" "}
                {entry.content.treatmentApplied ?? "sin tratamiento aplicado registrado"}
              </Text>
              <Text testID="feedback-timeline-treatment-modification">
                Modificación del tratamiento:{" "}
                {entry.content.treatmentModification ?? "sin modificación registrada"}
              </Text>
              {entry.content.revisedDiagnosis !== null ? (
                <Text testID="feedback-timeline-revised-diagnosis">
                  Cambio de diagnóstico registrado: {entry.content.revisedDiagnosis} (el diagnóstico
                  original permanece sin cambios)
                </Text>
              ) : null}
              {entry.content.adverseEvents.map((evento, index) => (
                <Text
                  accessibilityLabel={
                    evento.severity === "grave"
                      ? `Evento adverso grave: ${evento.description}`
                      : undefined
                  }
                  bold={evento.severity === "grave"}
                  className={evento.severity === "grave" ? "text-red-700" : undefined}
                  key={`${entry.record.id}-adverse-${index}`}
                  testID="feedback-timeline-adverse-event"
                >
                  Evento adverso ({ADVERSE_EVENT_SEVERITY_LABELS[evento.severity]}):{" "}
                  {evento.description}
                </Text>
              ))}

              <AttributionBadge attribution={attributionDe(entry)} />
              {correcciones.length > 0 ? (
                <CorrectionHistory entries={correcciones.map(attributionDe)} />
              ) : null}
              {/* Solo la vigente se corrige: corregir una sustituida prellenaría su contenido
                  viejo y revertiría en silencio la corrección posterior (D7). */}
              {entry.effective ? (
                <Button
                  accessibilityLabel={`Corregir la entrada registrada el ${registradoEl}`}
                  onPress={() => onCorrect(entry)}
                  testID="feedback-correct"
                >
                  <ButtonText>Corregir entrada</ButtonText>
                </Button>
              ) : null}
            </Box>
          );
        })
      )}
    </VStack>
  );
}
