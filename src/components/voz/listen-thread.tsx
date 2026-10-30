import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DraftFactCard } from "@/components/voz/draft-fact-card";
import type { AudioFactEntry } from "@/features/voz/audio-fact-service";
import type { TranscriptSegmentEntry } from "@/features/voz/transcript-service";

type ListenThreadProps = {
  segments: TranscriptSegmentEntry[];
  facts: AudioFactEntry[];
  busy: boolean;
  onConfirm: (factId: string) => void;
  onDiscard: (factId: string) => void;
  onEdit: (factId: string, text: string) => void;
};

/** Hora local `HH:mm` del tramo. */
function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Hilo de escucha (sistema-visual «Hilo de escucha» · FR-015 · FR-017 · US6-AC13 · FR-031):
 * columna cronológica donde cada tramo transcrito lleva su hora y, debajo, los borradores
 * extraídos de él. No separa ni atribuye hablantes ni presenta nada como mensaje del sistema; los
 * tramos de calidad insuficiente se señalan como no confiables (sin antecedentes derivados).
 */
export function ListenThread({
  segments,
  facts,
  busy,
  onConfirm,
  onDiscard,
  onEdit,
}: ListenThreadProps) {
  const ordenados = [...segments].sort((a, b) => a.seq - b.seq);
  const conocidos = new Set(ordenados.map((segment) => segment.id));
  // Un borrador puede llegar antes que su tramo: no se oculta, se muestra al final.
  const huerfanos = facts.filter((fact) => !conocidos.has(fact.content.transcriptSegmentId));
  const tarjeta = (fact: AudioFactEntry) => (
    <DraftFactCard
      busy={busy}
      fact={fact}
      key={fact.record.id}
      onConfirm={onConfirm}
      onDiscard={onDiscard}
      onEdit={onEdit}
    />
  );
  return (
    <VStack aria-label="Hilo de escucha" className="w-full gap-4" testID="listen-thread">
      {ordenados.length === 0 ? <Text tone="muted">Todavía no hay tramos transcritos.</Text> : null}
      {ordenados.map((segment) => (
        <VStack className="gap-2" key={segment.id} testID="transcript-segment">
          <Card className="gap-1">
            <Text tone="muted" variant="strong">
              <time dateTime={segment.startedAt}>{hora(segment.startedAt)}</time>
              {` · Tramo ${segment.seq + 1}`}
            </Text>
            <Text>{segment.text}</Text>
            {segment.quality === "insufficient" ? (
              <Text tone="destructive" variant="strong">
                Tramo no confiable: no se derivan antecedentes de él (FR-031).
              </Text>
            ) : null}
          </Card>
          {facts.filter((fact) => fact.content.transcriptSegmentId === segment.id).map(tarjeta)}
        </VStack>
      ))}
      {huerfanos.map(tarjeta)}
    </VStack>
  );
}
