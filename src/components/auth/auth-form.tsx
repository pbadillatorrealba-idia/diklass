import type { PropsWithChildren } from "react";
import { View } from "react-native";

export type AuthFormProps = PropsWithChildren<{ onSubmit: () => void }>;

/** En nativo no hay `<form>`: el envío va por el botón y `onSubmitEditing` (design.md D16). */
export function AuthForm({ children }: AuthFormProps) {
  return <View className="w-full items-center">{children}</View>;
}
