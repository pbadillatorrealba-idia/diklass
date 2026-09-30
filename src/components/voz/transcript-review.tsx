import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { TranscriptSegmentEntry } from "@/features/voz/transcript-service";

/**
 * Revisión de la transcripción durante la consulta (FR-015 · US6-AC13 · FR-031 · US6-AC7): los
 * tramos se revisan mientras la consulta transcurre, y los de calidad insuficiente se señalan
 * como no confiables (sin antecedentes derivados de ellos).
 */
export function TranscriptReview({ segments }: { segments: TranscriptSegmentEntry[] }) {
  return (
    <VStack className="w-full gap-3" testID="transcript-review">
      <Heading level={2}>Transcripción</Heading>
      {segments.length === 0 ? <Text tone="muted">Todavía no hay tramos transcritos.</Text> : null}
      {segments.map((segment) => (
        <Card className="gap-1" key={segment.id} testID="transcript-segment">
          <Text variant="strong">{`Tramo ${segment.seq + 1}`}</Text>
          <Text>{segment.text}</Text>
          {segment.quality === "insufficient" ? (
            <Text tone="destructive" variant="strong">
              Tramo no confiable: no se derivan antecedentes de él (FR-031).
            </Text>
          ) : null}
        </Card>
      ))}
    </VStack>
  );
}
