import { Box } from "@/components/ui/box";
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
      <Heading size="md">Transcripción</Heading>
      {segments.length === 0 ? (
        <Text className="text-foreground/70">Todavía no hay tramos transcritos.</Text>
      ) : null}
      {segments.map((segment) => (
        <Box
          accessibilityLabel={`Tramo ${segment.seq + 1}: ${segment.text}`}
          className="rounded-xl border border-border bg-white p-3"
          key={segment.id}
          testID="transcript-segment"
        >
          <Text bold>{`Tramo ${segment.seq + 1}`}</Text>
          <Text>{segment.text}</Text>
          {segment.quality === "insufficient" ? (
            <Text bold className="text-error-700">
              Tramo no confiable: no se derivan antecedentes de él (FR-031).
            </Text>
          ) : null}
        </Box>
      ))}
    </VStack>
  );
}
