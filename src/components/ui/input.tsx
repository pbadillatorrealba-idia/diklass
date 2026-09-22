import { TextInput, type TextInputProps, View, type ViewProps } from "react-native";
import { useFormControl } from "@/components/ui/form-control";

// Mirrors `foreground` in tailwind.config.js.
const FOREGROUND = "#0f172a";

export type InputProps = ViewProps & { className?: string };

export function Input({ className, ...props }: InputProps) {
  const { isInvalid } = useFormControl();
  return (
    <View
      className={`w-full flex-row items-center rounded-xl border bg-white ${
        isInvalid ? "border-destructive" : "border-border"
      } ${className ?? ""}`.trim()}
      {...props}
    />
  );
}

export type InputFieldProps = TextInputProps & { className?: string };

export function InputField({ className, style, ...props }: InputFieldProps) {
  const { isInvalid } = useFormControl();
  return (
    <TextInput
      aria-invalid={isInvalid}
      className={`min-h-[44px] flex-1 px-4 py-3 text-base focus:outline-none ${
        className ?? ""
      }`.trim()}
      placeholderTextColor="#64748b"
      // Inline on purpose: on web, React Native Web's TextInput reset outranks a
      // `text-foreground` utility and left typed text at 2.53:1 (axe color-contrast).
      style={[{ color: FOREGROUND }, style]}
      {...props}
    />
  );
}
