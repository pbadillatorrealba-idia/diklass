import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { PlanForm, type PlanFormValues, PlanSummary } from "@/components/registro/plan-form";
import { Button, ButtonText } from "@/components/ui/button";
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlLabel,
  FormControlLabelText,
} from "@/components/ui/form-control";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { DiagnosisContent } from "@/features/registro/schema";
import type { Attribution } from "@/lib/attribution/types";

export type DiagnosisEntryView = {
  id: string;
  content: DiagnosisContent;
  attribution: Attribution;
};

type DiagnosisSectionProps = {
  entries: DiagnosisEntryView[];
  text: string;
  textError: string | null;
  isBusy: boolean;
  /** Consulta cerrada (D5): sus registros son inmutables — sin altas. */
  isSealed?: boolean;
  onTextChange: (text: string) => void;
  /** Plan de la consulta (FR-112): sus valores viven en la pantalla, como el texto. */
  plan: {
    values: PlanFormValues;
    error: string | null;
    onChange: (values: PlanFormValues) => void;
  };
  onSubmit: () => void;
};

/** Diagnóstico registrado por el veterinario (US3-AC1), con su atribución por entrada. */
export function DiagnosisSection({
  entries,
  text,
  textError,
  isBusy,
  isSealed = false,
  onTextChange,
  plan,
  onSubmit,
}: DiagnosisSectionProps) {
  return (
    <VStack className="w-full gap-4" testID="diagnosis-section">
      {isSealed ? null : (
        <FormControl isInvalid={Boolean(textError)}>
          <FormControlLabel>
            <FormControlLabelText>Diagnóstico registrado por el veterinario</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField
              accessibilityLabel="Diagnóstico registrado por el veterinario"
              aria-label="Diagnóstico registrado por el veterinario"
              className="min-h-textarea"
              editable={!isBusy}
              multiline
              onChangeText={onTextChange}
              testID="diagnosis-text"
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
      )}
      {isSealed ? null : (
        <PlanForm
          error={plan.error}
          isDisabled={isBusy}
          onChange={plan.onChange}
          values={plan.values}
        />
      )}
      {isSealed ? null : (
        <Button
          accessibilityLabel="Registrar diagnóstico"
          isDisabled={isBusy}
          onPress={onSubmit}
          testID="diagnosis-submit"
        >
          <ButtonText>Registrar diagnóstico</ButtonText>
        </Button>
      )}
      {entries.length === 0 ? (
        <Text testID="diagnosis-empty">Sin diagnósticos registrados en esta consulta.</Text>
      ) : (
        entries.map((entry, index) => (
          <VStack
            // La regla separa cada entrada de lo anterior; con la consulta cerrada, la primera no tiene
            // nada encima y quedaría pegada a la banda.
            className={`gap-2 ${isSealed && index === 0 ? "" : "border-t border-border pt-3"}`}
            key={entry.id}
            testID="diagnosis-entry"
          >
            <Text selectable>{entry.content.text}</Text>
            {entry.content.plan ? <PlanSummary plan={entry.content.plan} /> : null}
            <AttributionBadge attribution={entry.attribution} />
          </VStack>
        ))
      )}
    </VStack>
  );
}
