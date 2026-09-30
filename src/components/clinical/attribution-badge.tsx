import { Box } from "@/components/ui/box";
import { SignatureStamp } from "@/components/ui/signature-stamp";
import { Text } from "@/components/ui/text";
import { useVeterinarianDisplayName } from "@/features/clinical/use-veterinarian-display-name";
import type { Attribution } from "@/lib/attribution/types";

/**
 * Autor y momento de un registro. `approved` marca contenido aprobado (una sugerencia confirmada o
 * la epicrisis firmada), que se muestra como timbre de firma (FR-076 · D20).
 */
export function AttributionBadge({
  attribution,
  approved = false,
}: {
  attribution: Attribution;
  approved?: boolean;
}) {
  const { data: displayName } = useVeterinarianDisplayName(attribution.actorId);
  // Never fall back to the raw uuid: an attribution has to name a person (US12/AC2).
  const actor = displayName ?? "Profesional de la clínica";
  const occurredAt = new Date(attribution.occurredAt).toLocaleString("es-CL");

  if (approved) {
    return <SignatureStamp actor={actor} occurredAt={occurredAt} testID="attribution-badge" />;
  }

  return (
    <Box
      accessibilityLabel={`Atribuido a ${actor} el ${occurredAt}`}
      className="rounded-sm bg-muted p-2"
      testID="attribution-badge"
    >
      <Text variant="strong">{actor}</Text>
      <Text tone="muted">{occurredAt}</Text>
    </Box>
  );
}
