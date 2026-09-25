import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type PasswordToggleProps = { visible: boolean; onToggle: () => void };

/**
 * «Mostrar contraseña» / «Ocultar contraseña» (FR-090 · US15-AC4 · design.md D16): botón `ghost`
 * con estado `pressed` anunciado, dentro del campo y con el área táctil mínima.
 */
export function PasswordToggle({ onToggle, visible }: PasswordToggleProps) {
  const label = visible ? "Ocultar contraseña" : "Mostrar contraseña";
  return (
    <Button
      accessibilityLabel={label}
      aria-label={label}
      aria-pressed={visible}
      className="min-w-touch"
      onPress={onToggle}
      size="sm"
      testID="login-password-toggle"
      variant="ghost"
    >
      <Icon decorative name={visible ? "eye-off-outline" : "eye-outline"} tone="primary" />
    </Button>
  );
}
