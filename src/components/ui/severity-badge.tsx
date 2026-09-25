import { View } from "react-native";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text, type TextTone } from "@/components/ui/text";
import type { AdverseEventSeverity } from "@/features/retroalimentacion/schema";
import type { ThemeToken } from "@/theme/colors";

/**
 * Escala visual única de severidad clínica (FR-077 · design.md D4), sin tokens propios: cada nivel
 * reutiliza un estado. `critico` no existe en ningún vocabulario de datos todavía (006/007).
 */
const LEVELS = {
  leve: {
    box: "border-info bg-info-surface",
    icon: "information-outline",
    iconTone: "info",
    name: "Leve",
    strong: false,
    text: "default",
  },
  moderado: {
    box: "border-warning bg-warning-surface",
    icon: "alert-outline",
    iconTone: "warning",
    name: "Moderado",
    strong: false,
    text: "default",
  },
  grave: {
    box: "border-destructive bg-destructive-surface",
    icon: "alert",
    iconTone: "destructive",
    name: "Grave",
    strong: true,
    text: "default",
  },
  critico: {
    box: "border-destructive bg-destructive",
    icon: "alert-octagon",
    iconTone: "destructive-foreground",
    name: "Crítico",
    strong: true,
    text: "onDestructive",
  },
} as const satisfies Record<
  AdverseEventSeverity | "critico",
  {
    box: string;
    icon: IconName;
    iconTone: ThemeToken;
    name: string;
    strong: boolean;
    text: TextTone;
  }
>;

export type SeverityLevel = keyof typeof LEVELS;

export function SeverityBadge({ level, testID }: { level: SeverityLevel; testID?: string }) {
  const style = LEVELS[level];
  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-full border px-2 py-1 ${style.box}`}
      testID={testID}
    >
      {/* Decorativo: el nombre del nivel ya es texto visible. */}
      <Icon decorative name={style.icon} size="sm" tone={style.iconTone} />
      <Text tone={style.text} variant={style.strong ? "strong" : "body"}>
        {style.name}
      </Text>
    </View>
  );
}
