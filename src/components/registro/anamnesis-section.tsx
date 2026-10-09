import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { ProvenanceCorrection } from "@/components/clinical/correction-line";
import { PROVENANCE_OPTIONS } from "@/components/registro/labels";
import { OptionPicker } from "@/components/registro/option-picker";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
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
import {
  ANAMNESIS_SECTIONS,
  answerOptions,
  answerText,
  fieldLabel,
  sectionOf,
} from "@/features/registro/anamnesis-catalog";
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
  const activeSection = sectionOf(field);
  const closedAnswers = answerOptions(field);
  const registered = new Set(entries.map((entry) => entry.content.field as string));
  // Sin información no es un hallazgo negativo (US2-AC4): cada sección cuenta lo que falta y la
  // sección activa lista sus campos como «Desconocido».
  const unknownBySection = ANAMNESIS_SECTIONS.map((section) => ({
    section,
    unknown: section.fields.filter((f) => !registered.has(f.id)),
  })).filter(({ unknown }) => unknown.length > 0);
  const unknownInActive =
    unknownBySection.find(({ section }) => section.id === activeSection)?.unknown ?? [];

  const changeField = (next: AnamnesisField) => {
    // El texto de una pregunta abierta no vale como respuesta cerrada, ni al revés.
    if (Boolean(answerOptions(next)) !== Boolean(closedAnswers) || closedAnswers) onTextChange("");
    onFieldChange(next);
  };
  const sectionOptions = [
    ...ANAMNESIS_SECTIONS.map((section) => ({ value: section.id, label: section.label })),
    { value: "texto_libre", label: "Texto libre" },
  ];
  const fieldOptions =
    activeSection === "texto_libre"
      ? [{ value: "texto_libre" as AnamnesisField, label: "Texto libre" }]
      : (ANAMNESIS_SECTIONS.find((section) => section.id === activeSection)?.fields ?? []).map(
          (f) => ({ value: f.id as AnamnesisField, label: f.label }),
        );

  return (
    <VStack className="w-full gap-4" testID="anamnesis-section">
      {unknownBySection.length > 0 ? (
        <VStack className="gap-1 border-b border-border pb-3" testID="anamnesis-unknown-panel">
          <Text variant="strong">Campos estructurados sin información</Text>
          <Text tone="muted">
            Aparecen como desconocidos: sin información no es un hallazgo negativo.
          </Text>
          {unknownBySection.map(({ section, unknown }) => (
            <Text key={section.id} testID="anamnesis-unknown-section">
              {section.label}: {unknown.length} de {section.fields.length} sin información
            </Text>
          ))}
          {unknownInActive.map((f) => (
            <Text key={f.id} testID="anamnesis-unknown-field">
              {f.label}: Desconocido
            </Text>
          ))}
        </VStack>
      ) : null}
      {isSealed ? (
        <Text tone="muted">
          Consulta cerrada: sus registros quedan sellados y no admiten cambios.
        </Text>
      ) : (
        <VStack className="gap-4 border-b border-border pb-4">
          <OptionPicker
            label="Sección de la anamnesis"
            onChange={(sectionId) => {
              const first =
                sectionId === "texto_libre"
                  ? "texto_libre"
                  : ANAMNESIS_SECTIONS.find((section) => section.id === sectionId)?.fields[0]?.id;
              if (first) changeField(first as AnamnesisField);
            }}
            options={sectionOptions}
            testID="anamnesis-section-picker"
            value={activeSection}
          />
          <OptionPicker
            label="Campo de anamnesis"
            onChange={changeField}
            options={fieldOptions}
            testID="anamnesis-field"
            value={field}
          />
          {closedAnswers ? (
            <OptionPicker
              isDisabled={isBusy}
              label="Respuesta"
              onChange={onTextChange}
              options={closedAnswers}
              testID="anamnesis-answer"
              value={text}
            />
          ) : (
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
          )}
          {closedAnswers && textError ? (
            <FormControl isInvalid>
              <FormControlError>
                <FormControlErrorText>{textError}</FormControlErrorText>
              </FormControlError>
            </FormControl>
          ) : null}
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
          <VStack className="gap-2" key={entry.id} testID="anamnesis-entry">
            {/* Dato con procedencia (FR-021): el código va al margen (FR-097) y una corrección
                deja la procedencia anterior tachada junto al vigente (FR-098). */}
            <Field
              label={fieldLabel(entry.content.field)}
              mark={
                entry.content.provenanceHistory?.length ? (
                  <ProvenanceCorrection
                    current={entry.content.provenance}
                    previous={entry.content.provenanceHistory.map(({ provenance }) => provenance)}
                  />
                ) : undefined
              }
              provenance={entry.content.provenance}
            >
              {answerText(entry.content.field, entry.content.text)}
            </Field>
            <AttributionBadge attribution={entry.attribution} />
            {isSealed ? null : (
              <ProvenanceCorrector
                current={entry.content.provenance}
                fieldLabel={fieldLabel(entry.content.field)}
                isBusy={isBusy}
                onConfirm={(next) => onCorrectProvenance(entry.id, next)}
              />
            )}
          </VStack>
        ))
      )}
    </VStack>
  );
}

type ProvenanceCorrectorProps = {
  current: Provenance;
  fieldLabel: string;
  isBusy: boolean;
  onConfirm: (provenance: Provenance) => void;
};

/**
 * «Corregir procedencia» plegado tras un botón (D20). Las opciones solo marcan una selección:
 * la corrección se registra con «Guardar corrección», que no admite la procedencia vigente, y
 * «Cancelar» pliega sin escribir nada (revisión de la PR #41). Al desplegar, el foco va a la
 * opción elegida; al plegar, vuelve al botón en cuanto deja de estar ocupado (WCAG 2.4.3).
 */
function ProvenanceCorrector({ current, fieldLabel, isBusy, onConfirm }: ProvenanceCorrectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Provenance>(current);
  const toggleRef = useRef<View>(null);
  const returnFocus = useRef(false);

  // Un botón deshabilitado no admite foco: se devuelve cuando la operación termina.
  useEffect(() => {
    if (!returnFocus.current || isBusy || isOpen) return;
    returnFocus.current = false;
    toggleRef.current?.focus();
  });

  const close = () => {
    returnFocus.current = true;
    setIsOpen(false);
  };

  return (
    <VStack className="gap-2">
      <Button
        accessibilityLabel={`Corregir procedencia de ${fieldLabel}`}
        aria-expanded={isOpen}
        className="self-start"
        isDisabled={isBusy}
        onPress={() => {
          if (isOpen) {
            close();
            return;
          }
          setSelected(current);
          setIsOpen(true);
        }}
        ref={toggleRef}
        size="sm"
        testID="anamnesis-provenance-correct-toggle"
        variant="ghost"
      >
        <ButtonText>Corregir procedencia</ButtonText>
      </Button>
      {isOpen ? (
        <VStack className="gap-2" testID="anamnesis-provenance-correct-panel">
          <OptionPicker
            autoFocus
            label="Corregir procedencia"
            onChange={setSelected}
            options={PROVENANCE_OPTIONS}
            testID="anamnesis-provenance-correct"
            value={selected}
          />
          <View className="flex-row flex-wrap gap-2">
            <Button
              accessibilityLabel="Guardar corrección de procedencia"
              isDisabled={isBusy || selected === current}
              onPress={() => {
                close();
                onConfirm(selected);
              }}
              size="sm"
              testID="anamnesis-provenance-correct-save"
            >
              <ButtonText>Guardar corrección</ButtonText>
            </Button>
            <Button
              accessibilityLabel="Cancelar la corrección de procedencia"
              isDisabled={isBusy}
              onPress={close}
              size="sm"
              testID="anamnesis-provenance-correct-cancel"
              variant="outline"
            >
              <ButtonText>Cancelar</ButtonText>
            </Button>
          </View>
        </VStack>
      ) : null}
    </VStack>
  );
}
