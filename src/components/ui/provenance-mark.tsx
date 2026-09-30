import { View, type ViewProps } from "react-native";
import { PROVENANCE_LABELS, PROVENANCE_OPTIONS } from "@/components/registro/labels";
import { Text } from "@/components/ui/text";
import type { Provenance } from "@/features/registro/schema";

/**
 * Código de una letra por procedencia (FR-097 · design.md D20). «F» (fuente) marca `recuperada`
 * para no repetir la «R» de `reportada`. No cambia el vocabulario `Provenance`.
 */
export const PROVENANCE_CODES: Record<Provenance, string> = {
  reportada: "R",
  inferida: "I",
  recuperada: "F",
  desconocida: "?",
};

/** Recuadro del código: la letra da la forma y `desconocida` además va en trazo discontinuo. */
function CodeBox({ provenance, ...props }: ViewProps & { provenance: Provenance }) {
  return (
    <View
      {...props}
      className={`h-6 w-6 items-center justify-center rounded-sm border border-primary ${
        provenance === "desconocida" ? "border-dashed" : ""
      }`}
    >
      <Text className="font-semibold leading-5" tone="primary" variant="data">
        {PROVENANCE_CODES[provenance]}
      </Text>
    </View>
  );
}

export type ProvenanceMarkProps = { provenance: Provenance; testID?: string };

/** Marca al margen de un dato con procedencia: imagen con nombre «Procedencia: <etiqueta>». */
export function ProvenanceMark({ provenance, testID }: ProvenanceMarkProps) {
  const label = `Procedencia: ${PROVENANCE_LABELS[provenance]}`;
  return (
    <CodeBox
      accessibilityLabel={label}
      accessibilityRole="image"
      accessible
      aria-label={label}
      provenance={provenance}
      role="img"
      testID={testID}
    />
  );
}

/**
 * Clave de los cuatro códigos, visible en el encabezado de la consulta (FR-097 · US18-AC2). El
 * nombre de cada código es texto visible, así que el recuadro no repite «Procedencia:».
 */
export function ProvenanceKey({ testID }: { testID?: string }) {
  return (
    <View
      accessibilityLabel="Clave de procedencia"
      aria-label="Clave de procedencia"
      className="flex-row flex-wrap gap-x-4 gap-y-2"
      role="list"
      testID={testID}
    >
      {PROVENANCE_OPTIONS.map(({ value, label }) => (
        <View className="flex-row items-center gap-2" key={value} role="listitem">
          <CodeBox provenance={value} />
          <Text variant="caption">{label}</Text>
        </View>
      ))}
    </View>
  );
}
