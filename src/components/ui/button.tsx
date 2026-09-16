import { createContext, useContext } from "react";
import {
  Pressable,
  type PressableProps,
  Text as RNText,
  type TextProps as RNTextProps,
} from "react-native";

type ButtonContextValue = { isDisabled: boolean };

const ButtonContext = createContext<ButtonContextValue>({ isDisabled: false });

export type ButtonProps = Omit<PressableProps, "disabled"> & {
  className?: string;
  isDisabled?: boolean;
};

export function Button({ children, className, isDisabled = false, ...props }: ButtonProps) {
  return (
    <ButtonContext.Provider value={{ isDisabled }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled }}
        // `focus:` keeps a visible focus ring on web, required by WCAG 2.2 AA 2.4.7.
        className={`min-h-[44px] items-center justify-center rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
          isDisabled ? "bg-muted opacity-60" : "bg-primary active:opacity-80"
        } ${className ?? ""}`.trim()}
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
  const { isDisabled } = useContext(ButtonContext);
  return (
    <RNText
      className={`text-base font-semibold ${
        isDisabled ? "text-foreground/60" : "text-primary-foreground"
      } ${className ?? ""}`.trim()}
      {...props}
    />
  );
}
