import { useState } from "react";
import { z } from "zod";
import { ANTECEDENT_GROUP_LABELS, ANTECEDENT_GROUP_ORDER } from "@/components/registro/labels";
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
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { AntecedentGroup, AntecedentItem, PatientContent } from "@/features/registro/schema";

const antecedentTextSchema = z.string().trim().min(1, "Registra el texto del antecedente.");

const FINDING_OPTIONS: { value: "reported" | "negative"; label: string }[] = [
  { value: "reported", label: "Dato registrado" },
  { value: "negative", label: "Hallazgo negativo" },
];

type AntecedentDraft = { text: string; negative: boolean };

const EMPTY_DRAFTS: Record<AntecedentGroup, AntecedentDraft> = {
  medicalHistory: { text: "", negative: false },
  preexistingDiseases: { text: "", negative: false },
  currentMedications: { text: "", negative: false },
  knownAllergies: { text: "", negative: false },
  behavioralHistory: { text: "", negative: false },
};

type AntecedentsPanelProps = {
  content: PatientContent;
  isBusy: boolean;
  /** Resuelve `true` cuando el ítem quedó registrado; el formulario se limpia solo entonces. */
  onAdd: (group: AntecedentGroup, item: AntecedentItem) => Promise<boolean>;
};

/**
 * Antecedentes de la ficha por grupo, con alta por apéndice (FR-001 · US1-AC2): cada alta
 * añade un ítem al grupo sin tocar los datos previos. Un ítem negativo se muestra como
 * hallazgo negativo registrado, nunca como ausencia de dato (FR-044 · SC-024).
 */
export function AntecedentsPanel({ content, isBusy, onAdd }: AntecedentsPanelProps) {
  const [drafts, setDrafts] = useState<Record<AntecedentGroup, AntecedentDraft>>(EMPTY_DRAFTS);
  const [errors, setErrors] = useState<Partial<Record<AntecedentGroup, string>>>({});

  const handleAdd = async (group: AntecedentGroup) => {
    const result = antecedentTextSchema.safeParse(drafts[group].text);
    if (!result.success) {
      setErrors((prev) => ({
        ...prev,
        [group]: result.error.issues[0]?.message ?? "Este campo es obligatorio.",
      }));
      return;
    }
    setErrors((prev) => ({ ...prev, [group]: undefined }));
    const registered = await onAdd(group, {
      text: result.data,
      negative: drafts[group].negative,
    });
    if (registered) {
      setDrafts((prev) => ({ ...prev, [group]: { text: "", negative: false } }));
    }
  };

  return (
    <VStack className="w-full gap-3" testID="antecedents-panel">
      <Text variant="strong">Antecedentes</Text>
      {ANTECEDENT_GROUP_ORDER.map((group) => {
        const draft = drafts[group];
        const error = errors[group];
        const groupLabel = ANTECEDENT_GROUP_LABELS[group];
        return (
          <Card key={group} testID="antecedent-group">
            <Text variant="strong">{groupLabel}</Text>
            {content.antecedentes[group].length === 0 ? (
              <Text testID="antecedent-empty">Sin registrar</Text>
            ) : (
              content.antecedentes[group].map((item, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: lista de solo render, sin estado por fila; dos antecedentes pueden repetir su texto.
                <Text key={`${item.text}-${index}`} testID="antecedent-item">
                  {item.negative ? "Hallazgo negativo registrado" : "Dato registrado"}: {item.text}
                </Text>
              ))
            )}
            <FormControl isInvalid={Boolean(error)}>
              <FormControlLabel>
                <FormControlLabelText>Nuevo antecedente</FormControlLabelText>
              </FormControlLabel>
              <Input>
                <InputField
                  accessibilityLabel={`Nuevo antecedente para ${groupLabel}`}
                  aria-label={`Nuevo antecedente para ${groupLabel}`}
                  editable={!isBusy}
                  onChangeText={(text) =>
                    setDrafts((prev) => ({ ...prev, [group]: { ...prev[group], text } }))
                  }
                  testID="antecedent-add-text"
                  value={draft.text}
                />
              </Input>
              {error ? (
                <FormControlError>
                  <FormControlErrorText>{error}</FormControlErrorText>
                </FormControlError>
              ) : null}
            </FormControl>
            <OptionPicker
              label="Tipo de hallazgo"
              onChange={(value) =>
                setDrafts((prev) => ({
                  ...prev,
                  [group]: { ...prev[group], negative: value === "negative" },
                }))
              }
              options={FINDING_OPTIONS}
              testID="antecedent-finding"
              value={draft.negative ? "negative" : "reported"}
            />
            <Button
              accessibilityLabel={`Añadir antecedente a ${groupLabel}`}
              isDisabled={isBusy}
              onPress={() => void handleAdd(group)}
              testID="antecedent-add"
            >
              <ButtonText>Añadir antecedente</ButtonText>
            </Button>
          </Card>
        );
      })}
    </VStack>
  );
}
