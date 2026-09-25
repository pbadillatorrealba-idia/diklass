import { createContext, useContext } from "react";
import {
  Pressable,
  type PressableProps,
  Text as RNText,
  type TextProps as RNTextProps,
} from "react-native";

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
};

export function Button({
  children,
  className,
  isDisabled = false,
  size = "md",
  variant = "primary",
  ...props
}: ButtonProps) {
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
        role="button"
        {...props}
      >
        {children}
      </Pressable>
    </ButtonContext.Provider>
  );
}

export type ButtonTextProps = RNTextProps & { className?: string };

export function ButtonText({ className, ...props }: ButtonTextProps) {
  const { size, variant } = useContext(ButtonContext);
  return (
    <RNText
      className={`font-sans ${SIZES[size].text} font-semibold ${VARIANTS[variant].text} ${
        className ?? ""
      }`.trim()}
      {...props}
    />
  );
}
