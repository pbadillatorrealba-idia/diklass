import {
  ANTECEDENT_GROUP_LABELS,
  ANTECEDENT_GROUP_ORDER,
  MISSING_FIELD_LABELS,
} from "@/components/registro/labels";
import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { PatientContent } from "@/features/registro/schema";
import { computeMissingFichaFields, type MissingField } from "@/features/registro/summaries";

const KIND_LABELS: Record<MissingField["kind"], string> = {
  sin_dato: "Sin dato",
  sin_registrar_grupo: "Sin registrar",
};

/**
 * Panel de campos sin información de la ficha (FR-044 · SC-024 · US1-AC3). Distingue
 * VISIBLEMENTE un campo sin dato de un hallazgo negativo registrado: lo negativo cuenta
 * como información clínica, se lista aparte y nunca aparece como faltante.
 */
export function MissingFieldsPanel({ content }: { content: PatientContent }) {
  const missing = computeMissingFichaFields(content);
  const negativeFindings = ANTECEDENT_GROUP_ORDER.flatMap((group) =>
    content.antecedentes[group]
      .filter((item) => item.negative)
      .map((item) => ({ group, text: item.text })),
  );

  return (
    <Box className="rounded-xl border border-border bg-card p-4" testID="missing-fields-panel">
      <Text bold>Información de la ficha</Text>
      {missing.length === 0 ? (
        <Text testID="missing-fields-empty">
          La ficha tiene información registrada en todos sus campos.
        </Text>
      ) : (
        <VStack className="gap-1">
          <Text>Campos sin información registrada:</Text>
          {missing.map((item) => (
            <Text key={`${item.field}-${item.kind}`} testID="missing-field-item">
              {MISSING_FIELD_LABELS[item.field] ?? item.field}: {KIND_LABELS[item.kind]}
            </Text>
          ))}
        </VStack>
      )}
      <Text className="text-foreground/70">
        Un campo sin dato no es un hallazgo negativo: lo negativo solo cuenta como información
        cuando queda registrado explícitamente.
      </Text>
      {negativeFindings.length > 0 ? (
        <VStack className="gap-1">
          <Text bold>Hallazgos negativos registrados</Text>
          {negativeFindings.map((finding) => (
            <Text key={`${finding.group}-${finding.text}`} testID="negative-finding">
              Hallazgo negativo: {finding.text} ({ANTECEDENT_GROUP_LABELS[finding.group]})
            </Text>
          ))}
        </VStack>
      ) : null}
    </Box>
  );
}
