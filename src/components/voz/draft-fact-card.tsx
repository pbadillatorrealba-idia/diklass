import { useState } from "react";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Icon } from "@/components/ui/icon";
import { Input, InputField } from "@/components/ui/input";
import { ProvenanceMark } from "@/components/ui/provenance-mark";
import { SuggestedBlock } from "@/components/ui/suggested-block";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { fieldLabel } from "@/features/registro/anamnesis-catalog";
import type { AudioFactEntry } from "@/features/voz/audio-fact-service";

type DraftFactCardProps = {
  fact: AudioFactEntry;
  /** Otra operación sobre un borrador está en curso: las acciones se deshabilitan. */
  busy: boolean;
  onConfirm: (factId: string) => void;
  onDiscard: (factId: string) => void;
  onEdit: (factId: string, text: string) => void;
};

/**
 * Borrador extraído del audio (FR-017 · FR-021 · FR-032 · US6-AC3 · US6-AC6 · US6-AC9): se acepta,
 * corrige o descarta por separado; muestra el fragmento de transcripción que lo originó, su
 * procedencia `inferida` —también después de confirmar (US6-AC9)— y la contradicción detectada
 * como SEÑAL, sin sobrescribir nada (US6-AC8). Vive bajo su tramo en `ListenThread`.
 */
export function DraftFactCard({ fact, busy, onConfirm, onDiscard, onEdit }: DraftFactCardProps) {
  const [editando, setEditando] = useState(false);
  const [editText, setEditText] = useState("");
  const pendiente = fact.content.confirmationState === "pending";
  // La procedencia va al margen como código con nombre (FR-097 · D20).
  const detalle = (
    <Box className="flex-row items-start gap-3">
      <VStack className="flex-1 gap-1">
        <Text variant="strong">{fieldLabel(fact.content.field)}</Text>
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
    <Card className="gap-2" testID="draft-fact-card">
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
      {fact.content.confirmationState === "discarded" ? <Text tone="muted">Descartado</Text> : null}
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
              isDisabled={busy}
              onPress={() => onConfirm(fact.record.id)}
              testID="draft-fact-confirm"
            >
              <ButtonText>Confirmar</ButtonText>
            </Button>
            {editando ? (
              <Button
                accessibilityLabel="Guardar la corrección del antecedente"
                isDisabled={busy || editText.trim().length === 0}
                onPress={() => {
                  onEdit(fact.record.id, editText.trim());
                  setEditando(false);
                  setEditText("");
                }}
                testID="draft-fact-edit-save"
              >
                <ButtonText>Guardar</ButtonText>
              </Button>
            ) : (
              <Button
                accessibilityLabel={`Corregir antecedente: ${fact.content.text}`}
                isDisabled={busy}
                onPress={() => {
                  setEditando(true);
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
              isDisabled={busy}
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
}
