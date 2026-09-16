import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { useVeterinarianDisplayName } from "@/features/clinical/use-veterinarian-display-name";
import type { Attribution } from "@/lib/attribution/types";

export function AttributionBadge({ attribution }: { attribution: Attribution }) {
  const { data: displayName } = useVeterinarianDisplayName(attribution.actorId);
  // Never fall back to the raw uuid: an attribution has to name a person (US12/AC2).
  const actor = displayName ?? "Profesional de la clínica";
  const occurredAt = new Date(attribution.occurredAt).toLocaleString("es-CL");

  return (
    <Box
      accessibilityLabel={`Atribuido a ${actor} el ${occurredAt}`}
      className="rounded-lg bg-sky-100 p-2"
      testID="attribution-badge"
    >
      <Text bold>{actor}</Text>
      <Text className="text-foreground/70">{occurredAt}</Text>
    </Box>
  );
}
