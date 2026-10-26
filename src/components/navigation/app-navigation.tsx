import { NativeTabs } from "expo-router/unstable-native-tabs";
import { PanelDock } from "@/components/asistente/panel-dock";
import { ShellThreads } from "@/components/asistente/shell-threads";
import { DockProvider } from "@/features/asistente/panel-dock";
import { useThemeColors } from "@/theme/use-theme-colors";
import { SECTIONS } from "./sections";

/**
 * Navegación global en iOS/Android (FR-082 · design.md D12 · D15): la barra de pestañas nativa
 * de cada plataforma, con SF Symbols en iOS y Material Symbols en Android. Los colores salen del
 * tema para que coincidan con web y sigan el modo oscuro.
 */
export function AppNavigation() {
  const colors = useThemeColors();
  return (
    // En iOS/Android el asistente es la cinta al pie de cada pantalla, sobre la barra de pestañas
    // del sistema (sistema-visual «Dock de asistente en compacto»); sin verificar en dispositivo.
    <DockProvider value={<PanelDock />}>
      <ShellThreads />
      <NativeTabs
        backgroundColor={colors.card}
        iconColor={{ default: colors["muted-foreground"], selected: colors.primary }}
        labelStyle={{
          default: { color: colors["muted-foreground"] },
          selected: { color: colors.foreground },
        }}
        tintColor={colors.primary}
      >
        {SECTIONS.map((section) => (
          <NativeTabs.Trigger key={section.name} name={section.name}>
            <NativeTabs.Trigger.Icon md={section.md} sf={section.sf} />
            <NativeTabs.Trigger.Label>{section.label}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    </DockProvider>
  );
}
