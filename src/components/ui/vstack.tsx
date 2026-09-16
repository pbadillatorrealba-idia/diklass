import { View, type ViewProps } from "react-native";

export type VStackProps = ViewProps & { className?: string };

export function VStack({ className, ...props }: VStackProps) {
  return <View className={`flex-col ${className ?? ""}`.trim()} {...props} />;
}
