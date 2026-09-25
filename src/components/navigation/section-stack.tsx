import { Stack } from "expo-router";
import { useThemeColors } from "@/theme/use-theme-colors";

/**
 * Pila de una sección principal (Inicio, Pacientes, Seguimiento, Conocimiento; design.md D12).
 * Cada grupo de `src/app/(protected)/` la monta en su `_layout.tsx` con el nombre de su pantalla
 * raíz.
 *
 * - **Nativo:** la cabecera del sistema da el título (lo fija `Screen title`) y el retroceso. El
 *   título es grande en la raíz de iOS (FR-083).
 * - **Web:** la cabecera se oculta. La barra lateral o las pestañas dan el contexto, y `Screen`
 *   pinta el `h1` y el enlace «Volver».
 */
export function SectionStack({ root }: { root: string }) {
  const colors = useThemeColors();
  const isNative = process.env.EXPO_OS !== "web";
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: "minimal",
        headerShadowVisible: false,
        headerShown: isNative,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.foreground, fontFamily: "Atkinson Hyperlegible Next" },
        headerLargeTitleStyle: { color: colors.foreground },
      }}
    >
      <Stack.Screen
        name={root}
        options={{ headerLargeTitleEnabled: process.env.EXPO_OS === "ios" }}
      />
    </Stack>
  );
}
