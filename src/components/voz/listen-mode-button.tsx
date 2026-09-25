import { Button, ButtonText } from "@/components/ui/button";

type ListenModeButtonProps = {
  active: boolean;
  isBusy?: boolean;
  isDisabled?: boolean;
  onToggle: () => void;
};

/**
 * Botón «Modo de escucha» (FR-025 · FR-054 · US6-AC1 · US6-AC5 · US6-AC10): operable por
 * teclado, con etiqueta programática que nombra la acción, foco visible del paletín y
 * `aria-pressed` que refleja el estado de captura (nunca solo por color).
 */
export function ListenModeButton({
  active,
  isBusy = false,
  isDisabled = false,
  onToggle,
}: ListenModeButtonProps) {
  const etiqueta = active
    ? "Detener el modo de escucha clínica"
    : "Activar el modo de escucha clínica";
  return (
    <Button
      accessibilityLabel={etiqueta}
      accessibilityRole="button"
      aria-pressed={active}
      isDisabled={isDisabled || isBusy}
      onPress={onToggle}
      testID="listen-mode-button"
      // Grabando, el botón detiene la captura: se distingue por texto, `aria-pressed` y color.
      variant={active ? "destructive" : "primary"}
    >
      <ButtonText>{active ? "Detener escucha" : "Modo de escucha"}</ButtonText>
    </Button>
  );
}
