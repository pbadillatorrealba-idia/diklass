import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import { View } from "react-native";
import { LogoutButton } from "@/components/auth/logout-button";
import { Text } from "@/components/ui/text";
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
 * secciones) o en la barra superior compacta más la inferior (por debajo de `lg`, con las 4
 * clínicas, y Configuración desde el avatar). El orden del DOM coincide con el visual en cada
 * ancho.
 */
export function AppNavigation() {
  const { signOut } = useAuth();

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
        <View
          className="flex-row items-center justify-between border-b border-border bg-card px-4 py-1 lg:hidden"
          testID="app-topbar"
        >
          {/* Marca, no encabezado: el `h1` de la pantalla va primero en el orden de títulos. */}
          <Text variant="strong">Diklass</Text>
          <View className="flex-row items-center gap-2">
            <ThemeToggle />
            <AccountLink />
          </View>
        </View>
        <View
          aria-label="Secciones"
          className="hidden w-sidebar gap-6 border-r border-border bg-card p-4 lg:flex"
          role="navigation"
          testID="app-sidebar"
        >
          {/* Marca, no encabezado: el `h1` de la pantalla va primero en el orden de títulos. */}
          <Text variant="strong">Diklass</Text>
          <View className="flex-1 gap-1">{items("sidebar", SECTIONS)}</View>
          <View className="gap-3 border-t border-border pt-4">
            <AccountLink showName />
            <ThemeToggle showLabel />
            <LogoutButton onLogout={signOut} />
          </View>
        </View>
        <View className="flex-1" nativeID={CONTENT_ID} role="main" tabIndex={-1}>
          <TabSlot />
        </View>
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
