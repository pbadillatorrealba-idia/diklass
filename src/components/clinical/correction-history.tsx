import { Text, VStack } from "@gluestack-ui/themed";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import type { Attribution } from "@/lib/attribution/types";

export function CorrectionHistory({ entries }: { entries: Attribution[] }) {
  return (
    <VStack accessibilityLabel="Historial de correcciones" style={{ gap: 8 }}>
      <Text style={{ fontWeight: "700" }}>Historial de atribución</Text>
      {entries.map((entry) => (
        <AttributionBadge
          attribution={entry}
          key={`${entry.actorId}-${entry.occurredAt}-${entry.action}`}
        />
      ))}
    </VStack>
  );
}
