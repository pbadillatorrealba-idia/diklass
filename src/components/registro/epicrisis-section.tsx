import { useState } from "react";
import { Animated } from "react-native";
import { AttributionBadge } from "@/components/clinical/attribution-badge";
import { attributionFromRow } from "@/components/clinical/attribution-from-row";
import { CorrectionLine } from "@/components/clinical/correction-line";
import type { EpicrisisChange } from "@/components/registro/epicrisis-changes";
import { EpicrisisFields } from "@/components/registro/epicrisis-fields";
import type { useSignatureMotion } from "@/components/registro/signature-motion";
import type { ClinicalGuardOutcome } from "@/components/registro/use-clinical-guard";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { SuggestedBlock } from "@/components/ui/suggested-block";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { EpicrisisEntry } from "@/features/registro/epicrisis-service";
import type { EpicrisisContent } from "@/features/registro/schema";

type EpicrisisSectionProps = {
  isClosed: boolean;
  isBusy: boolean;
  /** La epicrisis efectiva de una consulta cerrada, o `null` si no hay ninguna aprobada. */
  effectiveEntry: EpicrisisEntry | null;
  corrections: EpicrisisChange[];
  /** El borrador en edición de una consulta abierta, o `null` si aún no se generó. */
  draftContent: EpicrisisContent | null;
  stampStyle: ReturnType<typeof useSignatureMotion>["stampStyle"];
  onGenerate: () => void;
  onDraftChange: (content: EpicrisisContent) => void;
  onSaveDraft: () => void;
  onApprove: () => void;
  onSubmitCorrection: (content: EpicrisisContent) => Promise<ClinicalGuardOutcome>;
};

/**
 * Contenido de la sección 3 «Epicrisis y firma»: el borrador editable mientras la consulta está
 * abierta y la epicrisis efectiva, con sus correcciones, una vez firmada. El contenedor de la
 * sección (su pliego canario, FR-099 · D20) lo pone la pantalla.
 */
export function EpicrisisSection({
  isClosed,
  isBusy,
  effectiveEntry,
  corrections,
  draftContent,
  stampStyle,
  onGenerate,
  onDraftChange,
  onSaveDraft,
  onApprove,
  onSubmitCorrection,
}: EpicrisisSectionProps) {
  const [correctionContent, setCorrectionContent] = useState<EpicrisisContent | null>(null);

  const saveCorrection = async () => {
    if (correctionContent === null) {
      return;
    }
    if ((await onSubmitCorrection(correctionContent)) === "ok") {
      setCorrectionContent(null);
    }
  };

  const effectiveAttribution = effectiveEntry && attributionFromRow(effectiveEntry.record);

  return (
    <VStack className="w-full gap-4" testID="epicrisis-section">
      {isClosed ? (
        effectiveEntry === null || effectiveAttribution === null ? (
          <Text testID="epicrisis-empty">Sin epicrisis aprobada para esta consulta.</Text>
        ) : (
          <>
            {/* Renglón de la sección 3, no una caja dentro de otra (D20). */}
            <VStack className="gap-2 border-b border-border pb-3" testID="epicrisis-effective">
              <Text variant="rubric">Epicrisis efectiva — registro definitivo</Text>
              {effectiveEntry.record.status === "corrective" ? (
                <Text>Corrige una versión anterior, que permanece registrada y recuperable.</Text>
              ) : null}
              <Animated.View
                style={[{ alignSelf: "flex-start" }, stampStyle]}
                testID="signature-motion"
              >
                <AttributionBadge approved attribution={effectiveAttribution} />
              </Animated.View>
            </VStack>
            {corrections.length > 0 ? (
              <VStack className="gap-2" testID="epicrisis-corrections">
                <Heading level={3}>Correcciones</Heading>
                {corrections.map((change) => (
                  <CorrectionLine
                    attribution={effectiveAttribution}
                    current={change.current}
                    key={change.field}
                    label={change.label}
                    previous={change.previous}
                    testID={`epicrisis-correction-${change.field}`}
                  />
                ))}
              </VStack>
            ) : null}
            <EpicrisisFields content={effectiveEntry.content} isEditable={false} />
            {correctionContent === null ? (
              <Button
                accessibilityLabel="Corregir epicrisis"
                isDisabled={isBusy}
                onPress={() => setCorrectionContent(effectiveEntry.content)}
                testID="epicrisis-correct"
              >
                <ButtonText>Corregir epicrisis</ButtonText>
              </Button>
            ) : (
              <VStack className="w-full gap-4">
                <Text variant="strong">Corrección de la epicrisis</Text>
                <Text tone="muted">
                  La corrección crea un registro adicional: la versión original permanece legible e
                  intocable.
                </Text>
                <EpicrisisFields
                  content={correctionContent}
                  isEditable
                  onChange={setCorrectionContent}
                />
                <Button
                  accessibilityLabel="Guardar corrección de la epicrisis"
                  isDisabled={isBusy}
                  onPress={() => void saveCorrection()}
                  testID="epicrisis-correct-save"
                >
                  <ButtonText>Guardar corrección</ButtonText>
                </Button>
                <Button
                  accessibilityLabel="Cancelar la corrección"
                  isDisabled={isBusy}
                  onPress={() => setCorrectionContent(null)}
                  testID="epicrisis-correct-cancel"
                  variant="outline"
                >
                  <ButtonText>Cancelar</ButtonText>
                </Button>
              </VStack>
            )}
          </>
        )
      ) : draftContent === null ? (
        <>
          <Text tone="muted">
            El borrador se arma con lo registrado en la sesión y en la ficha. No forma parte del
            historial clínico hasta que lo apruebes.
          </Text>
          <Button
            accessibilityLabel="Generar borrador de epicrisis"
            isDisabled={isBusy}
            onPress={onGenerate}
            testID="epicrisis-generate"
          >
            <ButtonText>Generar borrador</ButtonText>
          </Button>
        </>
      ) : (
        <>
          {/* Lo arma el sistema y no está validado (FR-076). */}
          <SuggestedBlock testID="consultation-draft-label">
            <Text variant="strong">Borrador de epicrisis</Text>
            <Text tone="muted">
              No es un registro definitivo: nada entra al historial sin tu validación explícita.
            </Text>
          </SuggestedBlock>
          <EpicrisisFields content={draftContent} isEditable onChange={onDraftChange} />
          <Button
            accessibilityLabel="Guardar borrador de epicrisis"
            isDisabled={isBusy}
            onPress={onSaveDraft}
            testID="epicrisis-save-draft"
            variant="outline"
          >
            <ButtonText>Guardar borrador</ButtonText>
          </Button>
          {/* Firmar es aprobar y cerrar (FR-010): la etiqueta visible y la accesible
              coinciden (WCAG 2.5.3). */}
          <Button
            accessibilityLabel="Firmar y cerrar consulta"
            isDisabled={isBusy}
            onPress={onApprove}
            testID="epicrisis-approve"
          >
            <ButtonText>Firmar y cerrar consulta</ButtonText>
          </Button>
        </>
      )}
    </VStack>
  );
}
