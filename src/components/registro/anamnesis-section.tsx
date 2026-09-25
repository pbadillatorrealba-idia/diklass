import { AttributionBadge } from "@/components/clinical/attribution-badge";
import {
  ANAMNESIS_FIELD_LABELS,
  ANAMNESIS_FIELD_OPTIONS,
  ANAMNESIS_STRUCTURED_ORDER,
  PROVENANCE_LABELS,
  PROVENANCE_OPTIONS,
} from "@/components/registro/labels";
import { OptionPicker } from "@/components/registro/option-picker";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { AnamnesisContent, AnamnesisField, Provenance } from "@/features/registro/schema";
import type { Attribution } from "@/lib/attribution/types";

export type AnamnesisEntryView = {
  id: string;
  content: AnamnesisContent;
  attribution: Attribution;
};

type AnamnesisSectionProps = {
  entries: AnamnesisEntryView[];
  field: AnamnesisField;
  text: string;
  provenance: Provenance;
  textError: string | null;
  isBusy: boolean;
  /** Consulta cerrada (D5): sus registros son inmutables — sin alta ni corrección de procedencia. */
  isSealed?: boolean;
  onFieldChange: (field: AnamnesisField) => void;
  onTextChange: (text: string) => void;
  onProvenanceChange: (provenance: Provenance) => void;
  onSubmit: () => void;
  onCorrectProvenance: (entryId: string, provenance: Provenance) => void;
};

/**
 * Editor de anamnesis (FR-004 · FR-021 · US2): campo estructurado y texto libre en una
 * misma consulta, procedencia por antecedente con corrección visible y recuperable
 * (US2-AC5) y atribución por entrada con `AttributionBadge` (US2-AC6). Un campo estructurado
 * sin información se muestra como DESCONOCIDO, nunca como hallazgo negativo (US2-AC4).
 */
export function AnamnesisSection({
  entries,
  field,
  text,
  provenance,
  textError,
  isBusy,
  isSealed = false,
  onFieldChange,
  onTextChange,
  onProvenanceChange,
  onSubmit,
  onCorrectProvenance,
}: AnamnesisSectionProps) {
  const unknownFields = ANAMNESIS_STRUCTURED_ORDER.filter(
    (candidate) => !entries.some((entry) => entry.content.field === candidate),
  );

  return (
    <VStack className="w-full gap-4" testID="anamnesis-section">
      <Heading level={2}>Anamnesis</Heading>
      {unknownFields.length > 0 ? (
        <Card testID="anamnesis-unknown-panel">
          <Text variant="strong">Campos estructurados sin información</Text>
          <Text tone="muted">
            Aparecen como desconocidos: sin información no es un hallazgo negativo.
          </Text>
          {unknownFields.map((candidate) => (
            <Text key={candidate} testID="anamnesis-unknown-field">
              {ANAMNESIS_FIELD_LABELS[candidate]}: Desconocido
            </Text>
          ))}
        </Card>
      ) : null}
      {isSealed ? (
        <Text tone="muted">
          Consulta cerrada: sus registros quedan sellados y no admiten cambios.
        </Text>
      ) : (
        <VStack className="rounded-xl border border-border bg-card p-4 gap-4">
          <OptionPicker
            label="Campo de anamnesis"
            onChange={onFieldChange}
            options={ANAMNESIS_FIELD_OPTIONS}
            testID="anamnesis-field"
            value={field}
          />
          <FormControl isInvalid={Boolean(textError)}>
            <FormControlLabel>
              <FormControlLabelText>Texto del antecedente</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                accessibilityLabel="Texto del antecedente"
                aria-label="Texto del antecedente"
                className="min-h-textarea"
                editable={!isBusy}
                multiline
                onChangeText={onTextChange}
                testID="anamnesis-text"
                textAlignVertical="top"
                value={text}
              />
            </Input>
            {textError ? (
              <FormControlError>
                <FormControlErrorText>{textError}</FormControlErrorText>
              </FormControlError>
            ) : null}
          </FormControl>
          <OptionPicker
            label="Procedencia"
            onChange={onProvenanceChange}
            options={PROVENANCE_OPTIONS}
            testID="anamnesis-provenance"
            value={provenance}
          />
          <Button
            accessibilityLabel="Registrar antecedente de anamnesis"
            isDisabled={isBusy}
            onPress={onSubmit}
            testID="anamnesis-submit"
          >
            <ButtonText>Registrar antecedente</ButtonText>
          </Button>
        </VStack>
      )}
      {entries.length === 0 ? (
        <Text testID="anamnesis-empty">Sin antecedentes registrados en esta consulta.</Text>
      ) : (
        entries.map((entry) => (
          <Card className="gap-2" key={entry.id} testID="anamnesis-entry">
            <Text variant="strong">{ANAMNESIS_FIELD_LABELS[entry.content.field]}</Text>
            <Text selectable>{entry.content.text}</Text>
            <Text>Procedencia: {PROVENANCE_LABELS[entry.content.provenance]}</Text>
            {(entry.content.provenanceHistory ?? []).map((previous, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: lista de solo render, sin estado por fila; la misma procedencia puede repetirse y no aporta identidad.
              <Text key={`${previous.provenance}-${index}`} testID="anamnesis-provenance-history">
                Corrección registrada; antes: {PROVENANCE_LABELS[previous.provenance]}
              </Text>
            ))}
            <AttributionBadge attribution={entry.attribution} />
            {isSealed ? null : (
              <OptionPicker
                label="Corregir procedencia"
                onChange={(next) => onCorrectProvenance(entry.id, next)}
                options={PROVENANCE_OPTIONS}
                testID="anamnesis-provenance-correct"
                value={entry.content.provenance}
              />
            )}
          </Card>
        ))
      )}
    </VStack>
  );
}
