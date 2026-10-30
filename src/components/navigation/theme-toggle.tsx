import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useColorScheme, useThemePreference } from "@/theme/use-color-scheme";

/**
 * Cambio rápido entre claro y oscuro (FR-091). Fija la preferencia; «Usar el del sistema» vive en
 * Configuración › Apariencia. El nombre accesible anuncia el modo al que se pasa.
 */
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const scheme = useColorScheme();
  const { setPreference } = useThemePreference();
  const next = scheme === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Cambiar a modo oscuro" : "Cambiar a modo claro";
  return (
    <Button
      accessibilityLabel={label}
      className="min-w-touch flex-row gap-2 self-start px-3"
      onPress={() => void setPreference(next)}
      testID="theme-toggle"
      variant="ghost"
    >
      <Icon decorative name={next === "dark" ? "weather-night" : "white-balance-sunny"} />
      {showLabel ? <ButtonText>{next === "dark" ? "Modo oscuro" : "Modo claro"}</ButtonText> : null}
    </Button>
  );
}
