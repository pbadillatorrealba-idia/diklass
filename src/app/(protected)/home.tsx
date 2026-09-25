import { useRouter } from "expo-router";
import Head from "expo-router/head";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/features/auth/auth-provider";
import { useSessionStore } from "@/stores/session-store";

export default function HomeScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const displayName = useSessionStore((state) => state.displayName);

  return (
    <Screen className="flex-1 justify-between" scroll={false}>
      <Head>
        <title>Panel clínico · Diklass</title>
      </Head>
      <VStack className="gap-3">
        <Heading level={1}>Panel clínico</Heading>
        <Text accessibilityLabel="Identidad autenticada" testID="authenticated-identity">
          Sesión activa: {displayName}
        </Text>
        <Text tone="muted">
          Tu identidad queda asociada a las operaciones clínicas de esta sesión.
        </Text>
        <Button
          accessibilityLabel="Ir a pacientes"
          onPress={() => router.push("/patients")}
          testID="home-patients"
        >
          <ButtonText>Pacientes</ButtonText>
        </Button>
        <Button
          accessibilityLabel="Ir a la base de conocimiento"
          onPress={() => router.push("/knowledge")}
          testID="home-knowledge"
        >
          <ButtonText>Base de conocimiento</ButtonText>
        </Button>
      </VStack>
      <LogoutButton onLogout={signOut} />
    </Screen>
  );
}
