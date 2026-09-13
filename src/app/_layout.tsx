import { Stack } from "expo-router";
import { AppUiProvider } from "@/components/ui/gluestack";
import { AuthProvider } from "@/features/auth/auth-provider";
import { QueryProvider } from "@/lib/query/query-client";

export default function RootLayout() {
  return (
    <AppUiProvider>
      <QueryProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </QueryProvider>
    </AppUiProvider>
  );
}
