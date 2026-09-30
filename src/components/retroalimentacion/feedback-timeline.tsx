// biome-ignore-all lint/suspicious/noArrayIndexKey: filas de solo render de eventos adversos; la lista de una entrada registrada no muta.

import { type ReactElement, type ReactNode, useState } from "react";
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
  AdverseEventReportEntry,
  FeedbackAntecedent,
  FeedbackTimelineEntry,
} from "@/features/retroalimentacion/feedback-summary";
import type { Attribution } from "@/lib/attribution/types";
import { AdverseEventItem, AdverseEventToggle } from "./adverse-event-report";
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
  events?: AdverseEventReportEntry[];
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

type TimelineRow =
  | { kind: "feedback"; entry: FeedbackTimelineEntry }
  | { kind: "timeline-empty" }
  | { kind: "event-heading" }
  | { kind: "event-empty" }
  | { kind: "event"; entry: AdverseEventReportEntry; superseded: boolean }
  | { kind: "event-toggle"; count: number };

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
  events = [],
  footer,
  header,
  isPending,
  onCorrect,
  onRetry,
  title,
}: FeedbackTimelineProps) {
  const [showSuperseded, setShowSuperseded] = useState(false);
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
  const vigentes = events.filter((entry) => entry.effective);
  const sustituidos = events.filter((entry) => !entry.effective);
  const rows: TimelineRow[] =
    isPending || error
      ? []
      : [
          ...entries.map((entry): TimelineRow => ({ kind: "feedback", entry })),
          ...(entries.length === 0 ? [{ kind: "timeline-empty" } as const] : []),
          { kind: "event-heading" },
          ...(vigentes.length === 0 ? [{ kind: "event-empty" } as const] : []),
          ...vigentes.map((entry): TimelineRow => ({ kind: "event", entry, superseded: false })),
          ...(sustituidos.length > 0
            ? [{ kind: "event-toggle", count: sustituidos.length } as const]
            : []),
          ...(showSuperseded
            ? sustituidos.map((entry): TimelineRow => ({ kind: "event", entry, superseded: true }))
            : []),
        ];

  return (
    <ScreenList
      back={back}
      data={rows}
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
      footer={!isPending && !error ? footer : undefined}
      header={
        <>
          {!isPending && !error ? header : null}
          <Heading level={2}>Evolución registrada</Heading>
        </>
      }
      keyExtractor={(row) => {
        if (row.kind === "feedback") return `feedback-${row.entry.record.id}`;
        if (row.kind === "event")
          return `event-${row.entry.feedbackRecordId}-${row.entry.eventIndex}-${row.superseded}`;
        return row.kind;
      }}
      renderItem={({ item: row }) => {
        if (row.kind === "timeline-empty") {
          return (
            <Text testID="feedback-timeline-empty">
              Sin retroalimentación registrada para este paciente.
            </Text>
          );
        }
        if (row.kind === "event-heading") {
          return (
            <Heading level={2} testID="adverse-event-report">
              Eventos adversos
            </Heading>
          );
        }
        if (row.kind === "event-empty") {
          return (
            <Text testID="adverse-event-empty">
              Sin eventos adversos en las versiones vigentes.
            </Text>
          );
        }
        if (row.kind === "event-toggle") {
          return (
            <AdverseEventToggle
              count={row.count}
              onPress={() => setShowSuperseded((value) => !value)}
              shown={showSuperseded}
            />
          );
        }
        if (row.kind === "event") {
          return <AdverseEventItem entry={row.entry} superseded={row.superseded} />;
        }
        const entry = row.entry;
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
