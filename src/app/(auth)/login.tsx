import { Redirect } from "expo-router";
import { SafeAreaView, ScrollView } from "react-native";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/features/auth/auth-provider";

export default function LoginScreen() {
  const { isLoading, signIn, user } = useAuth();
  if (!isLoading && user) {
    return <Redirect href="/home" />;
  }

  return (
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flex: 1 }}>
      <ScrollView
        accessibilityLabel="Formulario de inicio de sesión"
        contentContainerStyle={{
          alignItems: "center",
          flexGrow: 1,
          justifyContent: "center",
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <LoginForm onSubmit={signIn} />
      </ScrollView>
    </SafeAreaView>
  );
}
