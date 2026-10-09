import { useState } from "react";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input, InputField } from "@/components/ui/input";
import { ProvenanceMark } from "@/components/ui/provenance-mark";
import { SuggestedBlock } from "@/components/ui/suggested-block";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { fieldLabel } from "@/features/registro/anamnesis-catalog";
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
      <Heading level={2}>Antecedentes extraídos (borrador)</Heading>
      {facts.length === 0 ? (
        <Text tone="muted">
          Nada extraído todavía: todo antecedente requiere tu confirmación explícita.
        </Text>
      ) : null}
      {facts.map((fact) => {
        const pendiente = fact.content.confirmationState === "pending";
        const etiquetaCampo = fieldLabel(fact.content.field);
        const editando = editId === fact.record.id;
        // La procedencia va al margen como código con nombre (FR-097 · D20).
        const detalle = (
          <Box className="flex-row items-start gap-3">
            <VStack className="flex-1 gap-1">
              <Text variant="strong">{etiquetaCampo}</Text>
              <Text selectable>{fact.content.text}</Text>
              <Text
                selectable
                tone="muted"
              >{`Fragmento de origen: «${fact.content.transcriptExcerpt}»`}</Text>
            </VStack>
            <ProvenanceMark provenance={fact.content.provenance} />
          </Box>
        );
        return (
          <Card className="gap-2" key={fact.record.id} testID="draft-fact-card">
            {pendiente ? <SuggestedBlock>{detalle}</SuggestedBlock> : detalle}
            {fact.content.contradiction ? (
              <Callout testID="draft-fact-contradiction" title="Contradicción" tone="warning">
                {fact.content.contradiction.note}
              </Callout>
            ) : null}
            {fact.content.confirmationState === "confirmed" ? (
              // Confirmado: deja de ser sugerencia y muestra quién lo validó (FR-076).
              <VStack className="gap-2">
                <Box className="flex-row items-center gap-1">
                  <Icon decorative name="check-circle-outline" size="sm" tone="success" />
                  <Text tone="success" variant="strong">
                    Confirmado
                  </Text>
                </Box>
                {fact.record.updated_by && fact.record.updated_at ? (
                  <AttributionBadge
                    approved
                    attribution={{
                      action: null,
                      actorId: fact.record.updated_by,
                      occurredAt: fact.record.updated_at,
                    }}
                  />
                ) : null}
              </VStack>
            ) : null}
            {fact.content.confirmationState === "discarded" ? (
              <Text tone="muted">Descartado</Text>
            ) : null}
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
                      variant="outline"
                    >
                      <ButtonText>Corregir</ButtonText>
                    </Button>
                  )}
                  <Button
                    accessibilityLabel={`Descartar antecedente: ${fact.content.text}`}
                    isDisabled={busyFactId !== null}
                    onPress={() => onDiscard(fact.record.id)}
                    testID="draft-fact-discard"
                    variant="outline"
                  >
                    <ButtonText>Descartar</ButtonText>
                  </Button>
                </Box>
              </VStack>
            ) : null}
          </Card>
        );
      })}
    </VStack>
  );
}
