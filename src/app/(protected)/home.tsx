import { Box, Heading, Text, VStack } from "@gluestack-ui/themed";
import { useCallback } from "react";
import { SafeAreaView } from "react-native";
import { LogoutButton } from "@/components/auth/logout-button";
import { SessionExpiredDialog } from "@/components/auth/session-expired-dialog";
import type { AccessSessionRpcClient } from "@/features/auth/access-session-service";
import { useAuth } from "@/features/auth/auth-provider";
import { useSessionActivity } from "@/features/auth/use-session-activity";
import { supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

export default function HomeScreen() {
  const { signOut, user } = useAuth();
  const accessSessionId = useSessionStore((state) => state.accessSessionId);
  const isExpiredDialogOpen = useUiStore((state) => state.isSessionExpiredDialogOpen);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const closeExpiredDialog = useUiStore((state) => state.closeSessionExpiredDialog);
  const handleExpired = useCallback(() => openExpiredDialog(), [openExpiredDialog]);
  useSessionActivity({
    client: supabase as unknown as AccessSessionRpcClient,
    onExpired: handleExpired,
    sessionId: accessSessionId,
  });

  const handleReauthenticate = useCallback(async () => {
    closeExpiredDialog();
    await signOut();
  }, [closeExpiredDialog, signOut]);

  return (
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flex: 1 }}>
      <Box flex={1} padding={24}>
        <VStack flex={1} justifyContent="space-between" style={{ gap: 32 }}>
          <VStack style={{ gap: 12 }}>
            <Heading style={{ fontSize: 30, fontWeight: "700" }}>Panel clínico</Heading>
            <Text accessibilityLabel="Identidad autenticada">Sesión activa: {user?.email}</Text>
            <Text color="$textLight600">
              Tu identidad queda asociada a las operaciones clínicas de esta sesión.
            </Text>
          </VStack>
          <LogoutButton onLogout={signOut} />
        </VStack>
      </Box>
      <SessionExpiredDialog
        visible={isExpiredDialogOpen}
        onReauthenticate={() => void handleReauthenticate()}
      />
    </SafeAreaView>
  );
}
