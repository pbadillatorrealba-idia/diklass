import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { Attribution } from "@/lib/attribution/types";

export function CorrectionHistory({ entries }: { entries: Attribution[] }) {
  return (
    <VStack accessibilityLabel="Historial de correcciones" className="gap-2">
      <Text bold>Historial de atribución</Text>
      {entries.map((entry) => (
        <AttributionBadge
          attribution={entry}
          key={`${entry.actorId}-${entry.occurredAt}-${entry.action}`}
        />
      ))}
    </VStack>
  );
}
