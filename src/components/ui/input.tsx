import { TextInput, type TextInputProps, View, type ViewProps } from "react-native";
import { useFormControl } from "@/components/ui/form-control";
import { useThemeColors } from "@/theme/use-theme-colors";
import { CONTINUOUS_CURVE } from "./border-curve";

export type InputProps = ViewProps & { className?: string };

export function Input({ className, style, ...props }: InputProps) {
  const { isInvalid } = useFormControl();
  return (
    <View
      className={`w-full flex-row items-center rounded-xl border bg-card ${
        isInvalid ? "border-destructive" : "border-input"
      } ${className ?? ""}`.trim()}
      style={[CONTINUOUS_CURVE, style]}
      {...props}
    />
  );
}

export type InputFieldProps = TextInputProps & { className?: string };

export function InputField({ className, style, ...props }: InputFieldProps) {
  const { isInvalid } = useFormControl();
  const colors = useThemeColors();
  return (
    <TextInput
      aria-invalid={isInvalid}
      // `focus:` keeps a visible focus ring on web (WCAG 2.2 AA 2.4.7), same contract as Button.
      className={`min-h-touch flex-1 px-4 py-3 font-sans text-base focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${
        className ?? ""
      }`.trim()}
      placeholderTextColor={colors["muted-foreground"]}
      // Inline on purpose: on web, React Native Web's TextInput reset outranks a
      // `text-foreground` utility and left typed text at 2.53:1 (axe color-contrast).
      style={[{ color: colors.foreground }, style]}
      {...props}
    />
  );
}
