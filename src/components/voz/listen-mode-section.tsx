import { useState } from "react";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { ListenControls } from "@/components/voz/listen-controls";
import { ListenThread } from "@/components/voz/listen-thread";
import { toggleListenMode } from "@/features/voz/listen-mode-toggle";
import type { ListenModeApi } from "@/features/voz/use-listen-mode";

/** Motivo visible de un fallo (patrón `setSubmitError` del login-form): nunca un rechazo mudo. */
function mensajeDeError(error: unknown): string {
  const mensaje = error instanceof Error ? error.message : String(error);
  return mensaje.length > 0 ? mensaje : "No se pudo completar la operación.";
}

/**
 * Hilo «Escucha» del panel de asistente (D4 · FR-014 · FR-015 · FR-017 · FR-025 · FR-054 · US6):
 * controles de escucha y, debajo, el hilo cronológico de tramos con sus borradores. La captura es
 * la de `modo` —una sola por consulta, creada en la pantalla—, no una instancia de este hilo:
 * cerrar o colapsar el panel no la detiene. Detener funciona en CUALQUIER momento (FR-025 ·
 * US6-AC5) y, con la captura caída, el registro manual de anamnesis queda expedito (US6-AC10).
 * Todo fallo de las acciones se muestra con su motivo (US6-AC4 incluido).
 */
export function ListenModeSection({ modo }: { modo: ListenModeApi }) {
  const [pendingAction, setPendingAction] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const alternar = () => {
    setSubmitError(null);
    void toggleListenMode(modo, setPendingAction).catch((error: unknown) => {
      setSubmitError(mensajeDeError(error));
    });
  };
  const accion = (operacion: Promise<void>) => {
    setSubmitError(null);
    void operacion.catch((error: unknown) => {
      setSubmitError(mensajeDeError(error));
    });
  };

  return (
    <VStack className="w-full gap-4" testID="listen-mode-section">
      <Heading level={2}>Modo de escucha clínica</Heading>
      <Text tone="muted">
        Captura la conversación con el tutor por tramos de ~30 s. Todo antecedente extraído queda
        como borrador y requiere tu confirmación antes de entrar a la anamnesis.
      </Text>
      <ListenControls
        error={submitError}
        isBusy={pendingAction}
        modoReal={modo.modoReal}
        onToggle={alternar}
        state={modo.state}
      />
      <ListenThread
        busy={modo.isBusy}
        facts={modo.facts}
        onConfirm={(factId) => accion(modo.confirmFact(factId))}
        onDiscard={(factId) => accion(modo.discardFact(factId))}
        onEdit={(factId, text) => accion(modo.editFact(factId, text))}
        segments={modo.segments}
      />
    </VStack>
  );
}
