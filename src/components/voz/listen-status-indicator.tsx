import { Box } from "@/components/ui/box";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { ListenModeState } from "@/features/voz/listen-mode-controller";

const MENSAJES: Record<ListenModeState, string> = {
  inactivo: "Escucha inactiva",
  capturando: "Capturando audio…",
  detenido: "Escucha detenida",
  no_disponible: "Captura no disponible: la anamnesis manual sigue expedita",
};

/**
 * Indicador visible del estado de captura (FR-025 · FR-054 · US6-AC1 · US6-AC5 · US6-AC10):
 * `role="status"` con `aria-live="polite"`, mensaje textual en todo estado (el color nunca es
 * el único indicador) y etiqueta programática para lectores de pantalla.
 */
export function ListenStatusIndicator({ state }: { state: ListenModeState }) {
  const mensaje = MENSAJES[state];
  return (
    <Box
      accessibilityLabel={mensaje}
      aria-live="polite"
      className="flex-row items-center gap-2 rounded-lg bg-muted px-3 py-2"
      role="status"
      testID="listen-status-indicator"
    >
      {state === "capturando" ? (
        // Decorativo: el mensaje ya dice que se está capturando.
        <Icon decorative name="record-circle" size="sm" tone="destructive" />
      ) : null}
      <Text variant={state === "capturando" ? "strong" : "body"}>{mensaje}</Text>
    </Box>
  );
}
