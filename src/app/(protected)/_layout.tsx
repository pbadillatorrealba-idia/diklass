import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/features/auth/auth-provider";

export default function ProtectedLayout() {
  const { isLoading, user } = useAuth();
  if (isLoading) {
    return null;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
