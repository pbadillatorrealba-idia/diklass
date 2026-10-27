import { Redirect } from "expo-router";
import Head from "expo-router/head";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import { useAuth } from "@/features/auth/auth-provider";

export default function LoginScreen() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  if (!isLoading && isAuthenticated) {
    return <Redirect href="/home" />;
  }

  return (
    // Móvil: la hoja (`bg-card`) ocupa toda la pantalla, sin tarjeta; desde `md`, la tarjeta sobre la mesa.
    <View className="flex-1 bg-card md:bg-background">
      <SafeAreaView style={{ flex: 1 }}>
        <Head>
          <title>Iniciar sesión · Diklass</title>
        </Head>
        <ScrollView
          accessibilityLabel="Formulario de inicio de sesión"
          // FR-088 (revisión de la PR #38): en iOS el teclado no tapa «Iniciar sesión».
          automaticallyAdjustKeyboardInsets
          // Formulario centrado en vertical: solo esta pantalla lo necesita, así que no va en `Screen`.
          contentContainerClassName="grow gap-6 p-4 md:p-6"
          keyboardShouldPersistTaps="handled"
        >
          {/* Escritorio: esquina superior derecha. Móvil: bajo la tarjeta y con etiqueta, a mano del pulgar.
            Ambos en el flujo del scroll, no flotando: respetan el área segura y el teclado. */}
          <View className="hidden w-full flex-row justify-end md:flex">
            <ThemeToggle />
          </View>
          <View className="w-full flex-1 justify-center gap-4 md:items-center">
            <LoginForm onSubmit={signIn} />
            <View className="self-center md:hidden">
              <ThemeToggle showLabel />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
