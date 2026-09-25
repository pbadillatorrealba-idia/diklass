import { TabList, TabSlot, Tabs, TabTrigger } from "expo-router/ui";
import { View } from "react-native";
import { LogoutButton } from "@/components/auth/logout-button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/features/auth/auth-provider";
import { useSessionStore } from "@/stores/session-store";
import { NavItem } from "./nav-item";
import { SECTIONS } from "./sections";
import { SkipLink } from "./skip-link";

const CONTENT_ID = "contenido";

/**
 * Navegación global en web (FR-082 · design.md D12). El `TabList` oculto solo define las
 * rutas; se ven dos barras con los mismos disparadores: la lateral desde `lg` y la inferior por
 * debajo. El orden del DOM es: enlace de salto, barra lateral, contenido y barra inferior, igual
 * que el orden visual en cada ancho.
 */
export function AppNavigation() {
  const { signOut } = useAuth();
  const displayName = useSessionStore((state) => state.displayName);

  const items = (variant: "sidebar" | "tabbar") =>
    SECTIONS.map((section) => (
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
          aria-label="Secciones"
          className="hidden w-sidebar gap-6 border-r border-border bg-card p-4 lg:flex"
          role="navigation"
          testID="app-sidebar"
        >
          <Heading level={2}>Diklass</Heading>
          <View className="flex-1 gap-1">{items("sidebar")}</View>
          <View className="gap-3 border-t border-border pt-4">
            <Text tone="muted" variant="caption">
              {displayName}
            </Text>
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
          {items("tabbar")}
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
