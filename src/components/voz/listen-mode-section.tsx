import { useState } from "react";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { DraftFactsPanel } from "@/components/voz/draft-facts-panel";
import { ListenModeButton } from "@/components/voz/listen-mode-button";
import { ListenStatusIndicator } from "@/components/voz/listen-status-indicator";
import { TranscriptReview } from "@/components/voz/transcript-review";
import { toggleListenMode } from "@/features/voz/listen-mode-toggle";
import { useListenMode } from "@/features/voz/use-listen-mode";

type ListenModeSectionProps = {
  consultationId: string;
};

/** Motivo visible de un fallo (patrón `setSubmitError` del login-form): nunca un rechazo mudo. */
function mensajeDeError(error: unknown): string {
  const mensaje = error instanceof Error ? error.message : String(error);
  return mensaje.length > 0 ? mensaje : "No se pudo completar la operación.";
}

/**
 * Sección del modo de escucha clínica (D9 · FR-014 · FR-015 · FR-017 · FR-025 · FR-054 · US6):
 * entrada única y autocontenida para el workspace de consulta. El botón alterna activar/detener
 * y detener funciona en CUALQUIER momento de la captura (FR-025 · US6-AC5). Sin consulta abierta
 * no inicia captura (la garantía la da el servicio de sesiones) y, con la captura caída, el
 * indicador lo dice y el registro manual de anamnesis de 002 queda expedito (US6-AC10). Todo
 * fallo de las acciones se muestra con su motivo (US6-AC4 incluido).
 *
 * Montaje mínimo (requisito de integración R2) en `src/app/(protected)/consultations/[id].tsx`:
 *
 *   import { ListenModeSection } from "@/components/voz/listen-mode-section";
 *   …
 *   <ListenModeSection consultationId={id} />
 */
export function ListenModeSection({ consultationId }: ListenModeSectionProps) {
  const modo = useListenMode(consultationId);
  const [pendingAction, setPendingAction] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const alternar = () => {
    setSubmitError(null);
    void toggleListenMode(modo, setPendingAction).catch((error: unknown) => {
      setSubmitError(mensajeDeError(error));
    });
  };

  return (
    <VStack className="w-full gap-4" testID="listen-mode-section">
      <Heading size="lg">Modo de escucha clínica</Heading>
      <Text className="text-foreground/70">
        Captura la conversación con el tutor por tramos de ~30 s. Todo antecedente extraído queda
        como borrador y requiere tu confirmación antes de entrar a la anamnesis.
      </Text>
      <Box className="flex-row flex-wrap items-center gap-3">
        <ListenModeButton
          active={modo.state === "capturando"}
          isBusy={pendingAction}
          onToggle={alternar}
        />
        <ListenStatusIndicator state={modo.state} />
      </Box>
      {submitError ? (
        <Text bold className="text-error-700" testID="listen-mode-error">
          {submitError}
        </Text>
      ) : null}
      <TranscriptReview segments={modo.segments} />
      <DraftFactsPanel
        busyFactId={modo.isBusy ? "busy" : null}
        facts={modo.facts}
        onConfirm={(factId) => {
          setSubmitError(null);
          void modo.confirmFact(factId).catch((error: unknown) => {
            setSubmitError(mensajeDeError(error));
          });
        }}
        onDiscard={(factId) => {
          setSubmitError(null);
          void modo.discardFact(factId).catch((error: unknown) => {
            setSubmitError(mensajeDeError(error));
          });
        }}
        onEdit={(factId, text) => {
          setSubmitError(null);
          void modo.editFact(factId, text).catch((error: unknown) => {
            setSubmitError(mensajeDeError(error));
          });
        }}
      />
    </VStack>
  );
}
