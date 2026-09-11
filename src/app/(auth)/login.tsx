import { Redirect } from "expo-router";
import Head from "expo-router/head";
import { SafeAreaView, ScrollView } from "react-native";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/features/auth/auth-provider";

export default function LoginScreen() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  if (!isLoading && isAuthenticated) {
    return <Redirect href="/home" />;
  }

  return (
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flex: 1 }}>
      <Head>
        <title>Iniciar sesión · Diklass</title>
      </Head>
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
