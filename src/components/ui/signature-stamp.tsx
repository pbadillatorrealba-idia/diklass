import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { CONTINUOUS_CURVE } from "./border-curve";

export type SignatureStampProps = {
  /** Nombre del profesional que aprobó; nunca un identificador (US12-AC2). */
  actor: string;
  /** Momento de la aprobación, ya formateado. */
  occurredAt: string;
  testID?: string;
};

/**
 * Timbre de firma (FR-076 · FR-099 · design.md D20): marco de tampón en la tinta `stamp` con el
 * nombre y el momento de quien aprobó. Solo marca contenido aprobado y siempre nombra a un
 * profesional; nunca pinta una superficie.
 */
export function SignatureStamp({ actor, occurredAt, testID }: SignatureStampProps) {
  const label = `Firmado por ${actor} el ${occurredAt}`;
  return (
    <View
      accessibilityLabel={label}
      aria-label={label}
      className="gap-1 self-start rounded-sm border border-stamp px-3 py-2"
      role="group"
      style={CONTINUOUS_CURVE}
      testID={testID}
    >
      <Text tone="stamp" variant="rubric">
        Firmado
      </Text>
      <Text tone="stamp" variant="strong">
        {actor}
      </Text>
      <Text tone="stamp" variant="data">
        {occurredAt}
      </Text>
    </View>
  );
}
