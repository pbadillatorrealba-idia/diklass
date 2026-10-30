import { View } from "react-native";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { PROVENANCE_LABELS } from "@/components/registro/labels";
import { CONTINUOUS_CURVE } from "@/components/ui/border-curve";
import { PROVENANCE_CODES, ProvenanceMark } from "@/components/ui/provenance-mark";
import { Text } from "@/components/ui/text";
import type { Provenance } from "@/features/registro/schema";
import type { Attribution } from "@/lib/attribution/types";

/**
 * Valor reemplazado (FR-098): tachado con una sola línea y legible, precedido de «Reemplazado»
 * como texto, porque el tachado no se anuncia en los lectores de pantalla.
 */
function Replaced({ children }: { children: string }) {
  return (
    <View className="gap-1">
      <Text tone="correction" variant="caption">
        Reemplazado
      </Text>
      <Text className="line-through" selectable tone="muted">
        {children}
      </Text>
    </View>
  );
}

export type CorrectionLineProps = {
  label: string;
  previous: string;
  current: string;
  /** Autor y momento de la corrección. */
  attribution: Attribution;
  testID?: string;
};

/**
 * Renglón de corrección de un campo de la epicrisis (FR-098 · US18-AC3 · design.md D20): el valor
 * anterior tachado y el vigente en el pliego de corrección con su atribución.
 */
export function CorrectionLine({
  label,
  previous,
  current,
  attribution,
  testID,
}: CorrectionLineProps) {
  return (
    <View className="gap-2 border-b border-border py-2" testID={testID}>
      <Text variant="rubric">{label}</Text>
      <Replaced>{previous === "" ? "Sin contenido" : previous}</Replaced>
      <View
        className="gap-2 rounded-sm border border-correction bg-correction-surface p-3"
        style={CONTINUOUS_CURVE}
      >
        <Text selectable>{current === "" ? "Sin contenido" : current}</Text>
        <AttributionBadge attribution={attribution} />
      </View>
    </View>
  );
}

/**
 * Corrección de procedencia de una entrada de anamnesis (FR-098): las procedencias anteriores
 * (`provenanceHistory`) tachadas junto al código vigente.
 */
export function ProvenanceCorrection({
  current,
  previous,
}: {
  current: Provenance;
  previous: Provenance[];
}) {
  return (
    <View className="flex-row flex-wrap items-end gap-3" testID="anamnesis-provenance-history">
      {previous.map((provenance, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lista de solo render; la misma procedencia puede repetirse y no aporta identidad.
        <Replaced key={`${provenance}-${index}`}>
          {`${PROVENANCE_CODES[provenance]} · ${PROVENANCE_LABELS[provenance]}`}
        </Replaced>
      ))}
      <ProvenanceMark provenance={current} />
    </View>
  );
}
