import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
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
  onSubmit,
}: DiagnosisSectionProps) {
  return (
    <VStack className="w-full gap-4" testID="diagnosis-section">
      <Heading size="lg">Diagnóstico</Heading>
      {isSealed ? null : (
        <FormControl isInvalid={Boolean(textError)}>
          <FormControlLabel>
            <FormControlLabelText>Diagnóstico registrado por el veterinario</FormControlLabelText>
          </FormControlLabel>
          <Input>
            <InputField
              accessibilityLabel="Diagnóstico registrado por el veterinario"
              aria-label="Diagnóstico registrado por el veterinario"
              className="min-h-[120px]"
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
        entries.map((entry) => (
          <Box
            className="rounded-xl border border-border bg-card p-4 gap-2"
            key={entry.id}
            testID="diagnosis-entry"
          >
            <Text>{entry.content.text}</Text>
            <AttributionBadge attribution={entry.attribution} />
          </Box>
        ))
      )}
    </VStack>
  );
}
