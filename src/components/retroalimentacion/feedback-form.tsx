// biome-ignore-all lint/suspicious/noArrayIndexKey: filas de formulario enteramente controladas por posición (value/errors[index]); sin estado interno por fila que perder al reordenar.

import { OptionPicker } from "@/components/registro/option-picker";
import { Box } from "@/components/ui/box";
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
import type {
  AdverseEventFormValue,
  FeedbackFormField,
  FeedbackFormValues,
} from "@/features/retroalimentacion/feedback-form-values";
import type {
  Adherence,
  AdverseEventSeverity,
  Evolution,
} from "@/features/retroalimentacion/schema";
import {
  Adherence as AdherenceValues,
  AdverseEventSeverity as AdverseEventSeverityValues,
  Evolution as EvolutionValues,
} from "@/features/retroalimentacion/schema";
import { ADHERENCE_LABELS, ADVERSE_EVENT_SEVERITY_LABELS, EVOLUTION_LABELS } from "./labels";

const ADHERENCE_OPTIONS = AdherenceValues.map((value) => ({
  value,
  label: ADHERENCE_LABELS[value],
}));

const EVOLUTION_OPTIONS = EvolutionValues.map((value) => ({
  value,
  label: EVOLUTION_LABELS[value],
}));

const SEVERITY_OPTIONS = AdverseEventSeverityValues.map((value) => ({
  value,
  label: ADVERSE_EVENT_SEVERITY_LABELS[value],
}));

const TEXT_FIELDS: { field: FeedbackFormField; label: string; testID: string }[] = [
  {
    field: "treatmentApplied",
    label: "Tratamiento efectivamente aplicado (vacío si no lo hubo)",
    testID: "feedback-treatment-applied",
  },
  {
    field: "treatmentModification",
    label: "Modificación del tratamiento",
    testID: "feedback-treatment-modification",
  },
  {
    field: "revisedDiagnosis",
    label: "Cambio de diagnóstico (el original permanece registrado)",
    testID: "feedback-revised-diagnosis",
  },
  {
    field: "evolutionNote",
    label: "Evolución observada (detalle)",
    testID: "feedback-evolution-note",
  },
];

type FeedbackFormProps = {
  values: FeedbackFormValues;
  errors: Record<string, string>;
  isDisabled?: boolean;
  onChange: (patch: Partial<FeedbackFormValues>) => void;
  onChangeAdverseEvent: (index: number, patch: Partial<AdverseEventFormValue>) => void;
  onAddAdverseEvent: () => void;
  onRemoveAdverseEvent: (index: number) => void;
};

/**
 * Formulario de una entrada de retroalimentación (FR-018). Los campos categóricos
 * —adherencia, evolución y severidad de cada evento adverso— se registran SOLO con controles
 * de selección: ningún campo categórico exige texto libre (SC-037). Etiquetas programáticas,
 * errores por campo (WCAG 2.2 AA 3.3.1) y operación por teclado vía `Button`/`Input`.
 */
export function FeedbackForm({
  values,
  errors,
  isDisabled = false,
  onChange,
  onChangeAdverseEvent,
  onAddAdverseEvent,
  onRemoveAdverseEvent,
}: FeedbackFormProps) {
  return (
    <VStack className="w-full gap-4" testID="feedback-form">
      <OptionPicker
        isDisabled={isDisabled}
        label="Adherencia al plan de seguimiento"
        onChange={(value: Adherence) => onChange({ adherence: value })}
        options={ADHERENCE_OPTIONS}
        testID="feedback-adherence"
        value={values.adherence}
      />
      <OptionPicker
        isDisabled={isDisabled}
        label="Evolución observada"
        onChange={(value: Evolution) => onChange({ evolution: value })}
        options={EVOLUTION_OPTIONS}
        testID="feedback-evolution"
        value={values.evolution}
      />
      {TEXT_FIELDS.map(({ field, label, testID }) => {
        const error = errors[field];
        return (
          <FormControl isInvalid={Boolean(error)} key={field}>
            <FormControlLabel>
              <FormControlLabelText>{label}</FormControlLabelText>
            </FormControlLabel>
            <Input>
              <InputField
                accessibilityLabel={label}
                aria-label={label}
                editable={!isDisabled}
                onChangeText={(text) => onChange({ [field]: text })}
                testID={testID}
                value={values[field]}
              />
            </Input>
            {error ? (
              <FormControlError>
                <FormControlErrorText>{error}</FormControlErrorText>
              </FormControlError>
            ) : null}
          </FormControl>
        );
      })}

      <VStack className="w-full gap-3" testID="feedback-adverse-events">
        <Text bold>Eventos adversos</Text>
        <Text className="text-foreground/70">
          Vacío significa «sin eventos adversos en esta entrada».
        </Text>
        {values.adverseEvents.map((evento, index) => (
          <Box
            className="rounded-lg border border-border bg-white p-3 gap-2"
            key={`adverse-${index}`}
          >
            <OptionPicker
              isDisabled={isDisabled}
              label={`Severidad del evento ${index + 1}`}
              onChange={(value: AdverseEventSeverity) =>
                onChangeAdverseEvent(index, { severity: value })
              }
              options={SEVERITY_OPTIONS}
              testID={`feedback-adverse-severity-${index}`}
              value={evento.severity}
            />
            <FormControl isInvalid={Boolean(errors[`adverseEvents.${index}.description`])}>
              <FormControlLabel>
                <FormControlLabelText>{`Descripción del evento ${index + 1}`}</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  accessibilityLabel={`Descripción del evento ${index + 1}`}
                  aria-label={`Descripción del evento ${index + 1}`}
                  editable={!isDisabled}
                  onChangeText={(text) => onChangeAdverseEvent(index, { description: text })}
                  testID={`feedback-adverse-description-${index}`}
                  value={evento.description}
                />
              </Input>
              {errors[`adverseEvents.${index}.description`] ? (
                <FormControlError>
                  <FormControlErrorText>
                    {errors[`adverseEvents.${index}.description`]}
                  </FormControlErrorText>
                </FormControlError>
              ) : null}
            </FormControl>
            <Button
              accessibilityLabel={`Quitar el evento adverso ${index + 1}`}
              isDisabled={isDisabled}
              onPress={() => onRemoveAdverseEvent(index)}
              testID={`feedback-adverse-remove-${index}`}
            >
              <ButtonText>Quitar evento</ButtonText>
            </Button>
          </Box>
        ))}
        <Button
          accessibilityLabel="Agregar evento adverso"
          isDisabled={isDisabled}
          onPress={onAddAdverseEvent}
          testID="feedback-adverse-add"
        >
          <ButtonText>Agregar evento adverso</ButtonText>
        </Button>
      </VStack>
    </VStack>
  );
}
