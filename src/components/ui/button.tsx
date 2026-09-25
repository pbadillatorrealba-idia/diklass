import { createContext, type Ref, use, useEffect, useRef } from "react";
import {
  Pressable,
  type PressableProps,
  Text as RNText,
  type TextProps as RNTextProps,
  type View,
} from "react-native";
import { CONTINUOUS_CURVE } from "./border-curve";

const VARIANTS = {
  primary: { surface: "bg-primary", text: "text-primary-foreground" },
  outline: { surface: "border border-input bg-card", text: "text-foreground" },
  // Acciones terciarias ("Ver fuente"): texto `primary`, verificado AA sobre card y fondo.
  ghost: { surface: "bg-transparent", text: "text-primary" },
  // Estado activo que detiene algo en curso (escucha clínica grabando).
  destructive: { surface: "bg-destructive", text: "text-destructive-foreground" },
} as const;

// Ambos tamaños conservan el área táctil mínima de 44 px (design.md D6).
const SIZES = {
  sm: { box: "px-3 py-2", text: "text-sm" },
  md: { box: "px-5 py-3", text: "text-base" },
} as const;

export type ButtonVariant = keyof typeof VARIANTS;
export type ButtonSize = keyof typeof SIZES;

const ButtonContext = createContext<{ variant: ButtonVariant; size: ButtonSize }>({
  size: "md",
  variant: "primary",
});

export type ButtonProps = Omit<PressableProps, "disabled"> & {
  className?: string;
  isDisabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Solo web: `submit` envía el `<form>` que lo contiene (design.md D16). RNW siempre pinta
   * `type="button"` y no reenvía `type`, así que se fija en el nodo al montar. En nativo no tiene
   * efecto: el envío va por `onPress`.
   */
  type?: "button" | "submit";
  /** `ref` como prop (React 19): `OptionPicker` mueve el foco entre opciones (D19). */
  ref?: Ref<View>;
};

export function Button({
  children,
  className,
  isDisabled = false,
  size = "md",
  style,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const submitRef = useRef<View>(null);
  useEffect(() => {
    if (process.env.EXPO_OS !== "web" || type !== "submit") return;
    (submitRef.current as unknown as HTMLElement | null)?.setAttribute("type", "submit");
  }, [type]);
  return (
    <ButtonContext.Provider value={{ size, variant }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        // `focus:` keeps a visible focus ring on web, required by WCAG 2.2 AA 2.4.7.
        // Disabled keeps the variant so a selected radio (OptionPicker) still reads as selected.
        className={`min-h-touch items-center justify-center rounded-xl ${SIZES[size].box} focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
          VARIANTS[variant].surface
        } ${isDisabled ? "opacity-50" : "active:opacity-80"} ${className ?? ""}`.trim()}
        disabled={isDisabled}
        // Sin `type="submit"`, la ref queda libre para quien la pase (`Link asChild`).
        ref={type === "submit" ? submitRef : undefined}
        role="button"
        // La curva solo existe en iOS. En web, un `style` compuesto hace que NativeWind acumule
        // las clases de renders anteriores (un botón ya habilitado seguía con `opacity-50`).
        // `Link asChild` también pasa `style`: se compone con la curva en vez de sustituirla.
        style={
          process.env.EXPO_OS !== "ios"
            ? style
            : typeof style === "function"
              ? (state) => [CONTINUOUS_CURVE, style(state)]
              : [CONTINUOUS_CURVE, style]
        }
        {...props}
      >
        {children}
      </Pressable>
    </ButtonContext.Provider>
  );
}

export type ButtonTextProps = RNTextProps & { className?: string };

export function ButtonText({ className, ...props }: ButtonTextProps) {
  const { size, variant } = use(ButtonContext);
  return (
    <RNText
      className={`font-sans ${SIZES[size].text} font-semibold ${VARIANTS[variant].text} ${
        className ?? ""
      }`.trim()}
      {...props}
    />
  );
}
