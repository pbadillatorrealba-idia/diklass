// biome-ignore-all lint/suspicious/noArrayIndexKey: filas de solo render de eventos adversos; la lista de una entrada registrada no muta.

import type { ReactElement, ReactNode } from "react";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { CorrectionHistory } from "@/components/clinical/correction-history";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { QueryState } from "@/components/ui/query-state";
import { ScreenList, type ScreenProps } from "@/components/ui/screen";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { Text } from "@/components/ui/text";
import type {
  FeedbackAntecedent,
  FeedbackTimelineEntry,
} from "@/features/retroalimentacion/feedback-summary";
import type { Attribution } from "@/lib/attribution/types";
import { ADHERENCE_LABELS, EVOLUTION_LABELS } from "./labels";

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
  antecedents?: FeedbackAntecedent[];
  onCorrect: (entry: FeedbackTimelineEntry) => void;
  /** Estado de la lectura (FR-085): el vacío no se muestra mientras carga. */
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  title?: string;
  back?: ScreenProps["back"];
  header?: ReactNode;
  footer?: ReactElement;
};

/**
 * Cronología de las entradas de retroalimentación de un paciente (FR-056 · US10-AC11): todas
 * las entradas en orden cronológico, cada corrección como registro nuevo visible junto al
 * original que permanece (FR-024 · US10-AC5) y atribución de autor y momento (FR-070). El
 * `grave` de un evento adverso se destaca para no diluirse (FR-041 · US10-AC2).
 */
export function FeedbackTimeline({
  antecedents = [],
  back,
  entries,
  error,
  footer,
  header,
  isPending,
  onCorrect,
  onRetry,
  title,
}: FeedbackTimelineProps) {
  const correccionesPorOriginal = new Map<string, Attribution[]>();
  const antecedentesPorRegistro = new Map(
    antecedents.map((antecedente) => [antecedente.feedbackRecordId, antecedente]),
  );
  for (const entry of entries) {
    if (entry.correctsRecordId === null) continue;
    const correcciones = correccionesPorOriginal.get(entry.correctsRecordId) ?? [];
    correcciones.push(attributionDe(entry));
    correccionesPorOriginal.set(entry.correctsRecordId, correcciones);
  }

  return (
    <ScreenList
      back={back}
      data={isPending || error ? [] : entries}
      empty={
        <QueryState
          empty={
            <Text testID="feedback-timeline-empty">
              Sin retroalimentación registrada para este paciente.
            </Text>
          }
          error={error}
          errorMessage="No pudimos cargar la evolución registrada."
          isEmpty={entries.length === 0}
          isPending={isPending}
          onRetry={onRetry}
          testID="feedback-timeline"
        >
          {null}
        </QueryState>
      }
      footer={footer}
      header={
        <>
          {header}
          <Heading level={2}>Evolución registrada</Heading>
        </>
      }
      keyExtractor={(entry) => entry.record.id}
      renderItem={({ item: entry }) => {
        const registradoEl = new Date(entry.record.created_at).toLocaleString("es-CL");
        const correcciones = correccionesPorOriginal.get(entry.record.id) ?? [];
        const antecedente = antecedentesPorRegistro.get(entry.record.id);
        return (
          <Card className="gap-2" testID="feedback-timeline-item">
            {antecedente ? (
              <Text selectable testID="feedback-antecedent-item">
                Consulta del{" "}
                {antecedente.consultationDate === null
                  ? "(fecha no disponible)"
                  : new Date(antecedente.consultationDate).toLocaleString("es-CL")}
                , evolución registrada el{" "}
                {new Date(antecedente.registeredAt).toLocaleString("es-CL")}: adherencia{" "}
                {ADHERENCE_LABELS[antecedente.adherence]}, evolución{" "}
                {EVOLUTION_LABELS[antecedente.evolution]}
                {antecedente.revisedDiagnosis === null
                  ? ""
                  : `; cambio de diagnóstico: ${antecedente.revisedDiagnosis}`}
              </Text>
            ) : null}
            <Text variant="strong" testID="feedback-timeline-registered-at">
              Entrada registrada el {registradoEl}
            </Text>
            <Text selectable>
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
            {entry.effective ? <Text testID="feedback-effective-mark">Versión vigente</Text> : null}

            <Text selectable>Adherencia: {ADHERENCE_LABELS[entry.content.adherence]}</Text>
            <Text selectable>Evolución: {EVOLUTION_LABELS[entry.content.evolution]}</Text>
            {entry.content.evolutionNote !== null ? (
              <Text selectable testID="feedback-timeline-evolution-note">
                {entry.content.evolutionNote}
              </Text>
            ) : null}
            <Text selectable testID="feedback-timeline-treatment-applied">
              Tratamiento aplicado:{" "}
              {entry.content.treatmentApplied ?? "sin tratamiento aplicado registrado"}
            </Text>
            <Text selectable testID="feedback-timeline-treatment-modification">
              Modificación del tratamiento:{" "}
              {entry.content.treatmentModification ?? "sin modificación registrada"}
            </Text>
            {entry.content.revisedDiagnosis !== null ? (
              <Text selectable testID="feedback-timeline-revised-diagnosis">
                Cambio de diagnóstico registrado: {entry.content.revisedDiagnosis} (el diagnóstico
                original permanece sin cambios)
              </Text>
            ) : null}
            {entry.content.adverseEvents.map((evento, index) => (
              <Box
                className="flex-row flex-wrap items-center gap-2"
                key={`${entry.record.id}-adverse-${index}`}
                testID="feedback-timeline-adverse-event"
              >
                <Text variant={evento.severity === "grave" ? "strong" : "body"}>
                  Evento adverso:
                </Text>
                <SeverityBadge level={evento.severity} />
                <Text selectable variant={evento.severity === "grave" ? "strong" : "body"}>
                  {evento.description}
                </Text>
              </Box>
            ))}

            <AttributionBadge attribution={attributionDe(entry)} />
            {correcciones.length > 0 ? <CorrectionHistory entries={correcciones} /> : null}
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
          </Card>
        );
      }}
      testID="feedback-timeline"
      title={title}
    />
  );
}
