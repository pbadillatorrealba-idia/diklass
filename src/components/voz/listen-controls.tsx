import { Box } from "@/components/ui/box";
import { Callout } from "@/components/ui/callout";
import { VStack } from "@/components/ui/vstack";
import { ListenModeButton } from "@/components/voz/listen-mode-button";
import { ListenStatusIndicator } from "@/components/voz/listen-status-indicator";
import { RecordingNotice } from "@/components/voz/recording-notice";
import type { ListenModeState } from "@/features/voz/listen-mode-controller";

type ListenControlsProps = {
  state: ListenModeState;
  /** Micrófono y transcripción reales: se avisa de la grabación y de que se conserva el audio. */
  modoReal: boolean;
  isBusy: boolean;
  /** Motivo visible del último fallo de una acción (nunca un rechazo mudo). */
  error: string | null;
  onToggle: () => void;
};

/**
 * Control de escucha del hilo (FR-025 · FR-054 · US6-AC1 · US6-AC5 · US6-AC10): el botón alterna
 * activar/detener —detener funciona en cualquier momento—, el indicador dice el estado en texto y
 * el aviso de grabación acompaña a la captura real.
 */
export function ListenControls({ state, modoReal, isBusy, error, onToggle }: ListenControlsProps) {
  return (
    <VStack className="w-full gap-3" testID="listen-controls">
      <Box className="flex-row flex-wrap items-center gap-3">
        <ListenModeButton active={state === "capturando"} isBusy={isBusy} onToggle={onToggle} />
        <ListenStatusIndicator state={state} />
      </Box>
      <RecordingNotice active={modoReal && state === "capturando"} />
      {error ? (
        <Callout testID="listen-mode-error" tone="error">
          {error}
        </Callout>
      ) : null}
    </VStack>
  );
}
