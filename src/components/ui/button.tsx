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
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

const ButtonContext = createContext<ButtonVariant>("primary");

export type ButtonProps = Omit<PressableProps, "disabled"> & {
  className?: string;
  isDisabled?: boolean;
  variant?: ButtonVariant;
};

export function Button({
  children,
  className,
  isDisabled = false,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <ButtonContext.Provider value={variant}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        // `focus:` keeps a visible focus ring on web, required by WCAG 2.2 AA 2.4.7.
        // Disabled keeps the variant so a selected radio (OptionPicker) still reads as selected.
        className={`min-h-[44px] items-center justify-center rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
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
  const variant = useContext(ButtonContext);
  return (
    <RNText
      className={`font-sans text-base font-semibold ${VARIANTS[variant].text} ${className ?? ""}`.trim()}
      {...props}
    />
  );
}
