import { Text as RNText, type TextProps as RNTextProps } from "react-native";

const SIZES = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  "2xl": "text-3xl",
  "3xl": "text-4xl",
} as const;

export type HeadingProps = RNTextProps & {
  className?: string;
  size?: keyof typeof SIZES;
};

export function Heading({ className, size = "md", ...props }: HeadingProps) {
  return (
    <RNText
      accessibilityRole="header"
      className={`text-foreground font-bold ${SIZES[size]} ${className ?? ""}`.trim()}
      role="heading"
      {...props}
    />
  );
}
