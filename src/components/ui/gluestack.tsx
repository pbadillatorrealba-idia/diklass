import type { PropsWithChildren } from "react";
import { View } from "react-native";
import "@/global.css";

/**
 * gluestack-ui v3 is NativeWind-based: the provider's job is to load the compiled
 * Tailwind stylesheet once and own the app-level surface colour. The visual
 * primitives live next to this file in `src/components/ui`.
 */
export function AppUiProvider({ children }: PropsWithChildren) {
  return <View className="bg-background flex-1">{children}</View>;
}
