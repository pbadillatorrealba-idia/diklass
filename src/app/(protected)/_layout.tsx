import { Redirect, Stack } from "expo-router";
import { useCallback } from "react";
import { View } from "react-native";
import { SessionExpiredDialog } from "@/components/auth/session-expired-dialog";
import type { AccessSessionRpcClient } from "@/features/auth/access-session-service";
import { useAuth } from "@/features/auth/auth-provider";
import { useSessionActivity } from "@/features/auth/use-session-activity";
import { supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

const accessSessionClient = supabase as unknown as AccessSessionRpcClient;

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const accessSessionId = useSessionStore((state) => state.accessSessionId);
  const isExpiredDialogOpen = useUiStore((state) => state.isSessionExpiredDialogOpen);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const closeExpiredDialog = useUiStore((state) => state.closeSessionExpiredDialog);
  const handleExpired = useCallback(() => openExpiredDialog(), [openExpiredDialog]);
  const { registerActivity } = useSessionActivity({
    client: accessSessionClient,
    onExpired: handleExpired,
    sessionId: accessSessionId,
  });

  const handleReauthenticate = useCallback(async () => {
    closeExpiredDialog();
    await signOut();
  }, [closeExpiredDialog, signOut]);

  if (isLoading) {
    return null;
  }
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <View onTouchStart={registerActivity} style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <SessionExpiredDialog
        onReauthenticate={() => void handleReauthenticate()}
        visible={isExpiredDialogOpen}
      />
    </View>
  );
}
