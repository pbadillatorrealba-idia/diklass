import { Box, Text } from "@gluestack-ui/themed";
import type { Attribution } from "@/lib/attribution/types";

export function AttributionBadge({ attribution }: { attribution: Attribution }) {
  return (
    <Box
      accessibilityLabel={`Atribuido a ${attribution.actorId} el ${attribution.occurredAt}`}
      style={{ backgroundColor: "#e0f2fe", borderRadius: 8, padding: 8 }}
    >
      <Text>{attribution.actorId}</Text>
      <Text color="$textLight600">{new Date(attribution.occurredAt).toLocaleString("es-CL")}</Text>
    </Box>
  );
}
