import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { ThemeToken } from "@/theme/colors";

const TONES = {
  error: {
    box: "border-destructive bg-destructive-surface",
    color: "destructive",
    icon: "alert-circle-outline",
    name: "Error",
  },
  warning: {
    box: "border-warning bg-warning-surface",
    color: "warning",
    icon: "alert-outline",
    name: "Aviso",
  },
  success: {
    box: "border-success bg-success-surface",
    color: "success",
    icon: "check-circle-outline",
    name: "Correcto",
  },
  info: {
    box: "border-info bg-info-surface",
    color: "info",
    icon: "information-outline",
    name: "Información",
  },
} as const satisfies Record<
  string,
  { box: string; color: ThemeToken; icon: IconName; name: string }
>;

export type CalloutTone = keyof typeof TONES;

export type CalloutProps = PropsWithChildren<{
  tone: CalloutTone;
  title?: string;
  className?: string;
  testID?: string;
}>;

/**
 * Aviso con estado (FR-075 · design.md D7): superficie tintada, borde e icono con nombre, para que
 * el color nunca sea la única señal. `error` y `warning` se anuncian al aparecer. Un texto plano
 * como contenido se envuelve en `Text`.
 */
export function Callout({ children, className, testID, title, tone }: CalloutProps) {
  const style = TONES[tone];
  const live = tone === "error" || tone === "warning";
  return (
    <View
      accessibilityLiveRegion={live ? "polite" : undefined}
      aria-live={live ? "polite" : undefined}
      className={`flex-row gap-2 rounded-lg border p-3 ${style.box} ${className ?? ""}`.trim()}
      testID={testID}
    >
      <Icon label={style.name} name={style.icon} tone={style.color} />
      <View className="flex-1 gap-1">
        {title ? <Text variant="strong">{title}</Text> : null}
        {typeof children === "string" ? <Text>{children}</Text> : children}
      </View>
    </View>
  );
}
