import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import { useWindowDimensions, View } from "react-native";
import { ASSISTANT_ID, AssistantPanel } from "@/components/asistente/assistant-panel";
import { PanelDock } from "@/components/asistente/panel-dock";
import { ShellThreads } from "@/components/asistente/shell-threads";
import { LogoutButton } from "@/components/auth/logout-button";
import { Logo } from "@/components/ui/logo";
import { DockProvider } from "@/features/asistente/panel-dock";
import { presentationFor } from "@/features/asistente/panel-store";
import { useAuth } from "@/features/auth/auth-provider";
import { AccountLink } from "./account-link";
import { NavItem } from "./nav-item";
import { SECTIONS, type Section, TABBAR_SECTIONS } from "./sections";
import { SkipLink } from "./skip-link";
import { ThemeToggle } from "./theme-toggle";

const CONTENT_ID = "contenido";

/**
 * Navegación global en web (FR-082 · FR-093 · design.md D12/D17). El `TabList` oculto solo
 * define las rutas; los disparadores visibles están en la barra lateral (desde `lg`, 5
 * secciones) o en la barra inferior (por debajo de `lg`, con las 3
 * clínicas más Configuración, que en móvil es la cuenta). A la derecha, el panel de asistente (acoplado,
 * riel o cajón desde 1024 px). El orden del DOM coincide con el visual en cada ancho.
 */
export function AppNavigation() {
  const { signOut } = useAuth();
  // Por debajo de 1024 px el panel es la cinta al pie de cada pantalla (D7), no una zona del shell.
  const compact = presentationFor(useWindowDimensions().width) === "dock";

  const items = (variant: "sidebar" | "tabbar", sections: readonly Section[]) =>
    sections.map((section) => (
      <TabTrigger asChild key={section.name} name={section.name}>
        <NavItem
          icon={section.icon}
          label={section.label}
          testID={`nav-${variant}-${section.href.slice(1)}`}
          variant={variant}
        />
      </TabTrigger>
    ));

  return (
    // `Tabs` no es un componente de React Native: NativeWind no interpreta su `className`.
    <Tabs style={{ flex: 1 }}>
      <View className="flex-1 bg-background lg:flex-row">
        <SkipLink targetId={CONTENT_ID} />
        {/* Solo desde `lg`: por debajo no hay panel (lo reemplaza el dock) y, invisible, desbordaría. */}
        <SkipLink
          className="left-56 hidden lg:flex"
          label="Ir al asistente"
          targetId={ASSISTANT_ID}
        />
        <View
          aria-label="Secciones"
          className="hidden w-sidebar gap-6 border-r border-border bg-card p-4 lg:flex"
          role="navigation"
          testID="app-sidebar"
        >
          {/* Marca, no encabezado: el `h1` de la pantalla va primero en el orden de títulos. */}
          <Logo />
          <View className="flex-1 gap-1">{items("sidebar", SECTIONS)}</View>
          <View className="gap-3 border-t border-border pt-4">
            <AccountLink showName />
            <ThemeToggle showLabel />
            <LogoutButton onLogout={signOut} />
          </View>
        </View>
        <DockProvider value={compact ? <PanelDock /> : null}>
          <View className="flex-1" nativeID={CONTENT_ID} role="main" tabIndex={-1}>
            <TabSlot />
          </View>
        </DockProvider>
        {/* Tercera zona del shell (sistema-visual «Shell de tres zonas»): después del contenido en el DOM. */}
        <ShellThreads />
        <AssistantPanel />
        <View
          aria-label="Secciones"
          className="flex-row border-t border-border bg-card lg:hidden"
          role="navigation"
          testID="app-tabbar"
        >
          {items("tabbar", TABBAR_SECTIONS)}
        </View>
      </View>
      <TabList style={{ display: "none" }}>
        {SECTIONS.map((section) => (
          <TabTrigger href={section.href} key={section.name} name={section.name} />
        ))}
      </TabList>
    </Tabs>
  );
}
