import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import type { PropsWithChildren } from "react";
import { Platform, useColorScheme, View } from "react-native";
import { palette } from "@/theme/colors";
import "@/global.css";

/**
 * gluestack-ui v3 is NativeWind-based: the provider's job is to load the compiled
 * Tailwind stylesheet once and own the app-level surface colour. The visual
 * primitives live next to this file in `src/components/ui`.
 *
 * The navigation theme repaints Expo Router's screen containers, which otherwise keep
 * React Navigation's light grey in dark mode. On web they stay transparent so the root
 * `bg-background` (a CSS media query) shows through from the first paint, before hydration.
 */
export function AppUiProvider({ children }: PropsWithChildren) {
  const isDark = useColorScheme() === "dark";
  const base = isDark ? DarkTheme : DefaultTheme;
  const colors = palette[isDark ? "dark" : "light"];
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      background: Platform.OS === "web" ? "transparent" : colors.background,
      border: colors.border,
      card: colors.card,
      notification: colors.destructive,
      primary: colors.primary,
      text: colors.foreground,
    },
  };
  return (
    <ThemeProvider value={theme}>
      <View className="bg-background flex-1">{children}</View>
    </ThemeProvider>
  );
}
