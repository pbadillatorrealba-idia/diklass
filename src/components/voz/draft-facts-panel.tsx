import { useState } from "react";
import { ANAMNESIS_FIELD_LABELS, PROVENANCE_LABELS } from "@/components/registro/labels";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { AudioFactEntry } from "@/features/voz/audio-fact-service";

type DraftFactsPanelProps = {
  facts: AudioFactEntry[];
  busyFactId?: string | null;
  onConfirm: (factId: string) => void;
  onDiscard: (factId: string) => void;
  onEdit: (factId: string, text: string) => void;
};

/**
 * Panel de borradores extraídos del audio (FR-017 · FR-021 · FR-032 · US6-AC3 · US6-AC6 ·
 * US6-AC9): cada antecedente se acepta, corrige o descarta por separado; muestra el fragmento
 * de transcripción que lo originó, su procedencia `inferida` —también después de confirmar
 * (US6-AC9)— y la contradicción detectada como SEÑAL, sin sobrescribir nada (US6-AC8).
 */
export function DraftFactsPanel({
  facts,
  busyFactId = null,
  onConfirm,
  onDiscard,
  onEdit,
}: DraftFactsPanelProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  return (
    <VStack className="w-full gap-3" testID="draft-facts-panel">
      <Heading size="md">Antecedentes extraídos (borrador)</Heading>
      {facts.length === 0 ? (
        <Text className="text-foreground/70">
          Nada extraído todavía: todo antecedente requiere tu confirmación explícita.
        </Text>
      ) : null}
      {facts.map((fact) => {
        const pendiente = fact.content.confirmationState === "pending";
        const etiquetaCampo = ANAMNESIS_FIELD_LABELS[fact.content.field];
        const editando = editId === fact.record.id;
        return (
          <Box
            accessibilityLabel={`Antecedente en borrador: ${fact.content.text}`}
            className="rounded-xl border border-border bg-white p-3"
            key={fact.record.id}
            testID="draft-fact-card"
          >
            <Text bold>{etiquetaCampo}</Text>
            <Text>{fact.content.text}</Text>
            <Text className="text-foreground/70">
              {`Fragmento de origen: «${fact.content.transcriptExcerpt}»`}
            </Text>
            <Text className="text-foreground/70">
              {`Procedencia: ${PROVENANCE_LABELS[fact.content.provenance]}`}
            </Text>
            {fact.content.contradiction ? (
              <Box
                accessibilityLabel={`Contradicción: ${fact.content.contradiction.note}`}
                className="rounded-lg bg-warning-100 p-2"
                testID="draft-fact-contradiction"
              >
                <Text bold className="text-warning-700">
                  {`Contradicción: ${fact.content.contradiction.note}`}
                </Text>
              </Box>
            ) : null}
            {fact.content.confirmationState === "confirmed" ? (
              <Text bold className="text-success-700">
                Confirmado
              </Text>
            ) : null}
            {fact.content.confirmationState === "discarded" ? <Text>Descartado</Text> : null}
            {pendiente ? (
              <VStack className="gap-2">
                {editando ? (
                  <FormControl>
                    <FormControlLabel>
                      <FormControlLabelText>Corregir el texto del antecedente</FormControlLabelText>
                    </FormControlLabel>
                    <Input>
                      <InputField
                        onChangeText={setEditText}
                        testID="draft-fact-edit-input"
                        value={editText}
                      />
                    </Input>
                  </FormControl>
                ) : null}
                <Box className="flex-row flex-wrap gap-2">
                  <Button
                    accessibilityLabel={`Confirmar antecedente: ${fact.content.text}`}
                    isDisabled={busyFactId !== null}
                    onPress={() => onConfirm(fact.record.id)}
                    testID="draft-fact-confirm"
                  >
                    <ButtonText>Confirmar</ButtonText>
                  </Button>
                  {editando ? (
                    <Button
                      accessibilityLabel="Guardar la corrección del antecedente"
                      isDisabled={busyFactId !== null || editText.trim().length === 0}
                      onPress={() => {
                        onEdit(fact.record.id, editText.trim());
                        setEditId(null);
                        setEditText("");
                      }}
                      testID="draft-fact-edit-save"
                    >
                      <ButtonText>Guardar</ButtonText>
                    </Button>
                  ) : (
                    <Button
                      accessibilityLabel={`Corregir antecedente: ${fact.content.text}`}
                      isDisabled={busyFactId !== null}
                      onPress={() => {
                        setEditId(fact.record.id);
                        setEditText(fact.content.text);
                      }}
                      testID="draft-fact-edit"
                    >
                      <ButtonText>Corregir</ButtonText>
                    </Button>
                  )}
                  <Button
                    accessibilityLabel={`Descartar antecedente: ${fact.content.text}`}
                    isDisabled={busyFactId !== null}
                    onPress={() => onDiscard(fact.record.id)}
                    testID="draft-fact-discard"
                  >
                    <ButtonText>Descartar</ButtonText>
                  </Button>
                </Box>
              </VStack>
            ) : null}
          </Box>
        );
      })}
    </VStack>
  );
}
