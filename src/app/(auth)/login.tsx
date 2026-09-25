import { Redirect } from "expo-router";
import Head from "expo-router/head";
import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoginForm } from "@/components/auth/login-form";
import { useAuth } from "@/features/auth/auth-provider";

export default function LoginScreen() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  if (!isLoading && isAuthenticated) {
    return <Redirect href="/home" />;
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Head>
        <title>Iniciar sesión · Diklass</title>
      </Head>
      <ScrollView
        accessibilityLabel="Formulario de inicio de sesión"
        // FR-088 (revisión de la PR #38): en iOS el teclado no tapa «Iniciar sesión».
        automaticallyAdjustKeyboardInsets
        // Formulario centrado en vertical: solo esta pantalla lo necesita, así que no va en `Screen`.
        contentContainerClassName="grow items-center justify-center p-4 md:p-6"
        keyboardShouldPersistTaps="handled"
      >
        <LoginForm onSubmit={signIn} />
      </ScrollView>
    </SafeAreaView>
  );
}
