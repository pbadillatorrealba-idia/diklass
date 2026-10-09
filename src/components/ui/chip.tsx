import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";

/** Tono → borde y fondo; el texto toma el mismo tono (pares verificados en `tema.test.ts`). */
const TONES = {
  neutral: { box: "border-border", text: "muted" },
  info: { box: "border-info bg-info-surface", text: "info" },
  success: { box: "border-success bg-success-surface", text: "success" },
  warning: { box: "border-warning bg-warning-surface", text: "warning" },
} as const;

export type ChipTone = keyof typeof TONES;

/** Etiqueta corta de estado o tipo de un dato (p. ej. «Negativo», «Cerrada»). */
export function Chip({ tone = "neutral", children }: { tone?: ChipTone; children: ReactNode }) {
  const { box, text } = TONES[tone];
  return (
    <View className={`rounded-full border px-2 ${box}`}>
      <Text tone={text} variant="caption">
        {children}
      </Text>
    </View>
  );
}
