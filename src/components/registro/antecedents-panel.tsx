import { useState } from "react";
import { View } from "react-native";
import { z } from "zod";
import { ANTECEDENT_GROUP_LABELS, ANTECEDENT_GROUP_ORDER } from "@/components/registro/labels";
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
import type { AntecedentGroup, AntecedentItem, PatientContent } from "@/features/registro/schema";

const antecedentTextSchema = z.string().trim().min(1, "Registra el texto del antecedente.");

type AntecedentsPanelProps = {
  content: PatientContent;
  isBusy: boolean;
  /** Resuelve `true` cuando el ítem quedó registrado; el formulario se limpia solo entonces. */
  onAdd: (group: AntecedentGroup, item: AntecedentItem) => Promise<boolean>;
};

/** Chip del tipo de ítem: lo negativo es información registrada (FR-044), no una ausencia. */
function KindChip({ negative }: { negative: boolean }) {
  return (
    <View
      className={`rounded-full border px-2 ${negative ? "border-info bg-info-surface" : "border-border"}`}
    >
      <Text tone={negative ? "info" : "muted"} variant="caption">
        {negative ? "Negativo" : "Dato"}
      </Text>
    </View>
  );
}

/**
 * Antecedentes de la ficha en una sola card, un bloque por grupo (FR-001 · US1-AC2): cada alta
 * añade un ítem al grupo sin tocar los datos previos. El alta se abre por grupo y se envía con
 * Enter. Un ítem negativo se muestra como hallazgo negativo registrado, nunca como ausencia de
 * dato (FR-044 · SC-024).
 */
export function AntecedentsPanel({ content, isBusy, onAdd }: AntecedentsPanelProps) {
  const [adding, setAdding] = useState<AntecedentGroup | null>(null);
  const [text, setText] = useState("");
  const [negative, setNegative] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (group: AntecedentGroup) => {
    setAdding(group);
    setText("");
    setNegative(false);
    setError(null);
  };

  const handleAdd = async (group: AntecedentGroup) => {
    const result = antecedentTextSchema.safeParse(text);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Este campo es obligatorio.");
      return;
    }
    setError(null);
    if (await onAdd(group, { text: result.data, negative })) {
      setText("");
      setNegative(false);
    }
  };

  return (
    <Card className="gap-4" testID="antecedents-panel">
      <Heading level={2}>Antecedentes</Heading>
      {ANTECEDENT_GROUP_ORDER.map((group, index) => {
        const groupLabel = ANTECEDENT_GROUP_LABELS[group];
        const items = content.antecedentes[group];
        const isAdding = adding === group;
        return (
          <View
            className={`gap-3 ${index > 0 ? "border-t border-border pt-4" : ""}`}
            key={group}
            testID="antecedent-group"
          >
            <View className="flex-row items-center justify-between gap-3">
              <Text variant="strong">
                {groupLabel}
                {items.length > 0 ? ` · ${items.length}` : ""}
              </Text>
              {isAdding ? null : (
                <Button
                  accessibilityLabel={`Añadir antecedente a ${groupLabel}`}
                  isDisabled={isBusy}
                  onPress={() => open(group)}
                  size="sm"
                  testID="antecedent-open"
                  variant="ghost"
                >
                  <ButtonText>+ Añadir</ButtonText>
                </Button>
              )}
            </View>
            {items.length === 0 ? (
              <Text testID="antecedent-empty" tone="muted">
                Sin registrar
              </Text>
            ) : (
              items.map((item, itemIndex) => (
                <View
                  className="flex-row flex-wrap items-center gap-x-3 gap-y-1"
                  // biome-ignore lint/suspicious/noArrayIndexKey: lista de solo render, sin estado por fila; dos antecedentes pueden repetir su texto.
                  key={`${item.text}-${itemIndex}`}
                >
                  <KindChip negative={item.negative} />
                  <Text className="shrink" selectable testID="antecedent-item">
                    {item.text}
                  </Text>
                  {item.recordedAt ? (
                    <Text tone="muted" variant="caption">
                      {new Date(item.recordedAt).toLocaleDateString("es-CL")}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
            {isAdding ? (
              <FormControl isInvalid={Boolean(error)}>
                <FormControlLabel>
                  <FormControlLabelText>Nuevo antecedente</FormControlLabelText>
                </FormControlLabel>
                <View className="flex-row flex-wrap items-center gap-2">
                  <Input className="min-w-48 flex-1">
                    <InputField
                      accessibilityLabel={`Nuevo antecedente para ${groupLabel}`}
                      aria-label={`Nuevo antecedente para ${groupLabel}`}
                      autoFocus
                      editable={!isBusy}
                      onChangeText={setText}
                      onSubmitEditing={() => void handleAdd(group)}
                      returnKeyType="done"
                      testID="antecedent-add-text"
                      value={text}
                    />
                  </Input>
                  <Button
                    accessibilityLabel="Marcar como hallazgo negativo"
                    aria-pressed={negative}
                    onPress={() => setNegative((prev) => !prev)}
                    testID="antecedent-negative"
                    variant={negative ? "primary" : "outline"}
                  >
                    <ButtonText>Negativo</ButtonText>
                  </Button>
                  <Button
                    accessibilityLabel={`Añadir antecedente a ${groupLabel}`}
                    isDisabled={isBusy}
                    onPress={() => void handleAdd(group)}
                    testID="antecedent-add"
                  >
                    <ButtonText>Añadir</ButtonText>
                  </Button>
                  <Button
                    accessibilityLabel="Cerrar el alta de antecedentes"
                    onPress={() => setAdding(null)}
                    testID="antecedent-close"
                    variant="ghost"
                  >
                    <ButtonText>Cerrar</ButtonText>
                  </Button>
                </View>
                {error ? (
                  <FormControlError>
                    <FormControlErrorText>{error}</FormControlErrorText>
                  </FormControlError>
                ) : null}
              </FormControl>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}
