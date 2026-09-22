import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/features/auth/auth-provider";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <View
        accessibilityLabel="Cargando"
        style={{ alignItems: "center", flex: 1, justifyContent: "center" }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? "/home" : "/login"} />;
}
