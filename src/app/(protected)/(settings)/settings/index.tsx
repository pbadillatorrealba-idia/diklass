import { View } from "react-native";
import { LogoutButton } from "@/components/auth/logout-button";
import { OptionPicker } from "@/components/registro/option-picker";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/features/auth/auth-provider";
import { useSessionStore } from "@/stores/session-store";
import type { ThemePreference } from "@/theme/theme-preference";
import { useThemePreference } from "@/theme/use-color-scheme";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

/** Configuración (FR-093): perfil, apariencia (FR-091) y sesión. */
export default function SettingsScreen() {
  const { signOut, user } = useAuth();
  const displayName = useSessionStore((state) => state.displayName) ?? "";
  const { preference, setPreference } = useThemePreference();

  return (
    <Screen testID="settings-screen" title="Configuración">
      <Card className="gap-4" testID="settings-profile">
        <Heading level={2}>Perfil</Heading>
        <View className="flex-row items-center gap-4">
          <Avatar name={displayName} size="lg" />
          <VStack className="flex-1 gap-1">
            <Text selectable variant="strong">
              {displayName}
            </Text>
            <Text selectable tone="muted" variant="caption">
              {user?.email ?? ""}
            </Text>
          </VStack>
        </View>
        <Text tone="muted" variant="caption">
          La edición de tus datos personales estará disponible próximamente.
        </Text>
      </Card>
      <Card className="gap-4" testID="settings-appearance">
        <Heading level={2}>Apariencia</Heading>
        <OptionPicker
          label="Tema"
          onChange={(value) => void setPreference(value)}
          options={THEME_OPTIONS}
          testID="settings-theme"
          value={preference}
        />
        <Text tone="muted" variant="caption">
          «Sistema» sigue el modo claro u oscuro de tu dispositivo. La preferencia se guarda solo en
          este dispositivo.
        </Text>
      </Card>
      <Card className="gap-4" testID="settings-session">
        <Heading level={2}>Sesión</Heading>
        <LogoutButton onLogout={signOut} />
      </Card>
    </Screen>
  );
}
