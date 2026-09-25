import type { Ref } from "react";
import { Pressable, type PressableProps, View } from "react-native";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const VARIANTS = {
  sidebar: {
    item: "min-h-touch flex-row items-center gap-3 rounded-lg px-3 py-2",
    indicator: "absolute bottom-2 left-0 top-2 w-1 rounded-full bg-primary",
    text: "body",
  },
  tabbar: {
    item: "min-h-touch min-w-0 flex-1 items-center justify-center gap-1 px-1 py-2",
    indicator: "absolute left-4 right-4 top-0 h-1 rounded-full bg-primary",
    text: "nav",
  },
} as const;

export type NavItemProps = Omit<PressableProps, "children"> & {
  href?: string;
  icon: IconName;
  isFocused?: boolean;
  label: string;
  ref?: Ref<View>;
  testID?: string;
  variant: keyof typeof VARIANTS;
};

/**
 * Enlace a una sección principal (FR-082 · design.md D12). Recibe de `TabTrigger asChild` el
 * `href`, `isFocused` y `onPress`. La sección actual se marca con `aria-current`, peso
 * semibold, una barra `bg-primary` y fondo `bg-muted`, nunca solo con el color.
 */
export function NavItem({
  href,
  icon,
  isFocused = false,
  label,
  testID,
  variant,
  // `TabTrigger asChild` inyecta su propio estilo de fila (`space-between`); el layout lo fija
  // `className`.
  style: _triggerStyle,
  ...props
}: NavItemProps) {
  const styles = VARIANTS[variant];
  // `href` no está tipado en React Native, pero React Native Web lo convierte en un `<a>` real.
  const link = { href } as object;
  return (
    <Pressable
      {...props}
      {...link}
      aria-current={isFocused ? "page" : undefined}
      className={`relative ${styles.item} ${isFocused ? "bg-muted" : ""}`.trim()}
      role="link"
      testID={testID}
    >
      {isFocused ? <View className={styles.indicator} testID={`${testID}-indicator`} /> : null}
      <Icon decorative name={icon} tone={isFocused ? "primary" : "muted-foreground"} />
      <Text
        className={`${variant === "tabbar" ? "w-full text-center" : ""} ${isFocused ? "font-semibold" : ""}`.trim()}
        tone={isFocused ? "default" : "muted"}
        variant={styles.text}
      >
        {label}
      </Text>
    </Pressable>
  );
}
