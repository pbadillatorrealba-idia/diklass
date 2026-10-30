import type { Ref } from "react";
import { Pressable, type PressableProps, View } from "react-native";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

const VARIANTS = {
  sidebar: {
    item: "min-h-touch flex-row items-center gap-3 rounded-sm px-3 py-2",
    indicator: "absolute bottom-2 left-0 top-2 w-1 rounded-sm bg-primary",
    text: "body",
  },
  tabbar: {
    item: "min-h-touch min-w-0 flex-1 items-center justify-center gap-1 py-2",
    indicator: "absolute left-4 right-4 top-0 h-1 rounded-sm bg-primary",
    text: "nav",
  },
} as const;

export type NavItemProps = Omit<PressableProps, "children"> & {
  href?: string;
  icon: IconName;
  /** Solo icono (la etiqueta pasa a ser el nombre accesible), para la pestaña de cuenta de la barra inferior. */
  iconOnly?: boolean;
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
  iconOnly = false,
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
      accessibilityLabel={iconOnly ? label : props.accessibilityLabel}
      aria-current={isFocused ? "page" : undefined}
      className={`relative ${styles.item} ${iconOnly ? "flex-none px-4" : ""} ${isFocused ? "bg-muted" : ""}`.trim()}
      role="link"
      testID={testID}
    >
      {isFocused ? <View className={styles.indicator} testID={`${testID}-indicator`} /> : null}
      <Icon decorative name={icon} tone={isFocused ? "primary" : "muted-foreground"} />
      {iconOnly ? null : (
        <Text
          className={`${variant === "tabbar" ? "w-full text-center" : ""} ${isFocused ? "font-semibold" : ""}`.trim()}
          tone={isFocused ? "default" : "muted"}
          variant={styles.text}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
