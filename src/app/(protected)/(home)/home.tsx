import { Link } from "expo-router";
import { useWindowDimensions } from "react-native";
import { LogoutButton } from "@/components/auth/logout-button";
import { SECTIONS } from "@/components/navigation/sections";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/features/auth/auth-provider";
import { useSessionStore } from "@/stores/session-store";

// Ancho `lg` de Tailwind: a partir de aquí, en web, la barra lateral ya ofrece cerrar sesión.
const SIDEBAR_MIN_WIDTH = 1024;

/** Accesos del panel de entrada (design.md D12); los `testID` los usan los e2e existentes. */
const ENTRIES = {
  "(patients)": { testID: "home-patients", label: "Ir a pacientes" },
  "(follow-up)": { testID: "home-follow-up", label: "Ir al seguimiento" },
  "(knowledge)": { testID: "home-knowledge", label: "Ir a la base de conocimiento" },
} as const;

export default function HomeScreen() {
  const { signOut } = useAuth();
  const { width } = useWindowDimensions();
  const displayName = useSessionStore((state) => state.displayName);
  const showLogout = process.env.EXPO_OS !== "web" || width < SIDEBAR_MIN_WIDTH;

  return (
    <Screen title="Panel clínico">
      <VStack className="gap-3">
        <Text accessibilityLabel="Identidad autenticada" testID="authenticated-identity">
          Sesión activa: {displayName}
        </Text>
        <Text tone="muted">
          Tu identidad queda asociada a las operaciones clínicas de esta sesión.
        </Text>
      </VStack>
      <VStack className="gap-3">
        {SECTIONS.filter((section) => section.name in ENTRIES).map((section) => {
          const entry = ENTRIES[section.name as keyof typeof ENTRIES];
          return (
            <Link asChild href={section.href} key={section.name}>
              <Button
                accessibilityLabel={entry.label}
                className="flex-row gap-2"
                testID={entry.testID}
                variant="outline"
              >
                <Icon decorative name={section.icon} />
                <ButtonText>{section.label}</ButtonText>
              </Button>
            </Link>
          );
        })}
      </VStack>
      {showLogout ? <LogoutButton onLogout={signOut} /> : null}
    </Screen>
  );
}
