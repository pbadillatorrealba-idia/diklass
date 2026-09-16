import Head from "expo-router/head";
import { SafeAreaView } from "react-native";
import { LogoutButton } from "@/components/auth/logout-button";
import { Box } from "@/components/ui/box";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAuth } from "@/features/auth/auth-provider";
import { useSessionStore } from "@/stores/session-store";

export default function HomeScreen() {
  const { signOut } = useAuth();
  const displayName = useSessionStore((state) => state.displayName);

  return (
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flex: 1 }}>
      <Head>
        <title>Panel clínico · Diklass</title>
      </Head>
      <Box className="flex-1 p-6">
        <VStack className="flex-1 justify-between gap-8">
          <VStack className="gap-3">
            <Heading size="2xl">Panel clínico</Heading>
            <Text accessibilityLabel="Identidad autenticada" testID="authenticated-identity">
              Sesión activa: {displayName}
            </Text>
            <Text className="text-foreground/70">
              Tu identidad queda asociada a las operaciones clínicas de esta sesión.
            </Text>
          </VStack>
          <LogoutButton onLogout={signOut} />
        </VStack>
      </Box>
    </SafeAreaView>
  );
}
