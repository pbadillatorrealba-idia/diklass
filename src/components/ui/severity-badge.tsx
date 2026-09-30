import { View } from "react-native";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text, type TextTone } from "@/components/ui/text";
import type { AdverseEventSeverity } from "@/features/retroalimentacion/schema";
import type { ThemeToken } from "@/theme/colors";

/**
 * Escala visual única de severidad clínica (FR-077 · design.md D4/D20), sin tokens propios: cada
 * nivel reutiliza un estado y suma tantos segmentos llenos como su posición. `critico` no existe en ningún vocabulario de datos todavía (006/007).
 */
const LEVELS = {
  leve: {
    box: "border-info bg-info-surface",
    icon: "information-outline",
    iconTone: "info",
    name: "Leve",
    position: 1,
    segment: { filled: "border-info bg-info", empty: "border-info" },
    strong: false,
    text: "default",
  },
  moderado: {
    box: "border-warning bg-warning-surface",
    icon: "alert-outline",
    iconTone: "warning",
    name: "Moderado",
    position: 2,
    segment: { filled: "border-warning bg-warning", empty: "border-warning" },
    strong: false,
    text: "default",
  },
  grave: {
    box: "border-destructive bg-destructive-surface",
    icon: "alert",
    iconTone: "destructive",
    name: "Grave",
    position: 3,
    segment: { filled: "border-destructive bg-destructive", empty: "border-destructive" },
    strong: true,
    text: "default",
  },
  critico: {
    box: "border-destructive bg-destructive",
    icon: "alert-octagon",
    iconTone: "destructive-foreground",
    name: "Crítico",
    position: 4,
    segment: {
      filled: "border-destructive-foreground bg-destructive-foreground",
      empty: "border-destructive-foreground",
    },
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
    position: 1 | 2 | 3 | 4;
    segment: { filled: string; empty: string };
    strong: boolean;
    text: TextTone;
  }
>;

export type SeverityLevel = keyof typeof LEVELS;

const SEGMENTS = [1, 2, 3, 4] as const;

export function SeverityBadge({ level, testID }: { level: SeverityLevel; testID?: string }) {
  const style = LEVELS[level];
  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-sm border px-2 py-1 ${style.box}`}
      testID={testID}
    >
      {/* Decorativo: el nombre del nivel ya es texto visible. */}
      <Icon decorative name={style.icon} size="sm" tone={style.iconTone} />
      <Text tone={style.text} variant={style.strong ? "strong" : "body"}>
        {style.name}
      </Text>
      {/* Barra de 4 segmentos (FR-077 · D20): lleno es sólido y vacío solo contorno, para leerse
          también en escala de grises. Decorativa: el nombre del nivel ya la dice. */}
      <View aria-hidden className="flex-row gap-1" testID="severity-bar">
        {SEGMENTS.map((segment) => {
          const filled = segment <= style.position;
          return (
            <View
              className={`h-3 w-1.5 border ${filled ? style.segment.filled : style.segment.empty}`}
              key={segment}
              testID={filled ? "severity-segment-filled" : "severity-segment-empty"}
            />
          );
        })}
      </View>
    </View>
  );
}
