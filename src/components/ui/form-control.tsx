import { createContext, useContext } from "react";
import { Text as RNText, type TextProps as RNTextProps, View, type ViewProps } from "react-native";

type FormControlContextValue = { isInvalid: boolean };

const FormControlContext = createContext<FormControlContextValue>({ isInvalid: false });

export function useFormControl(): FormControlContextValue {
  return useContext(FormControlContext);
}

export type FormControlProps = ViewProps & { className?: string; isInvalid?: boolean };

export function FormControl({ className, isInvalid = false, ...props }: FormControlProps) {
  return (
    <FormControlContext.Provider value={{ isInvalid }}>
      <View className={`w-full flex-col gap-1.5 ${className ?? ""}`.trim()} {...props} />
    </FormControlContext.Provider>
  );
}

export function FormControlLabel({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={`flex-row ${className ?? ""}`.trim()} {...props} />;
}

export function FormControlLabelText({
  className,
  ...props
}: RNTextProps & { className?: string }) {
  return (
    <RNText
      className={`text-foreground text-sm font-medium ${className ?? ""}`.trim()}
      {...props}
    />
  );
}

export function FormControlError({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={`flex-row ${className ?? ""}`.trim()} {...props} />;
}

export function FormControlErrorText({
  className,
  ...props
}: RNTextProps & { className?: string }) {
  return (
    <RNText
      // Announced by screen readers as soon as validation fails, per WCAG 2.2 AA 3.3.1.
      accessibilityLiveRegion="polite"
      className={`text-destructive text-sm ${className ?? ""}`.trim()}
      role="alert"
      {...props}
    />
  );
}
