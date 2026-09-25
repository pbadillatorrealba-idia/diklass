import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type PasswordToggleProps = { visible: boolean; onToggle: () => void };

/**
 * «Mostrar contraseña» (FR-090 · US15-AC4 · design.md D16): botón conmutador `ghost` con estado
 * `pressed` anunciado, dentro del campo y con el área táctil mínima.
 */
export function PasswordToggle({ onToggle, visible }: PasswordToggleProps) {
  // Nombre fijo: el estado lo anuncia `aria-pressed` (un nombre que también cambia se leería
  // «Ocultar contraseña, presionado» · revisión de la PR #38).
  const label = "Mostrar contraseña";
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
