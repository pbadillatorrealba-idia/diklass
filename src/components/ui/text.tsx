import { Text as RNText, type TextProps as RNTextProps } from "react-native";

const SIZES = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
} as const;

export type TextProps = RNTextProps & {
  className?: string;
  bold?: boolean;
  size?: keyof typeof SIZES;
};

export function Text({ bold = false, className, size = "md", ...props }: TextProps) {
  return (
    <RNText
      className={`text-foreground ${SIZES[size]} ${bold ? "font-semibold" : ""} ${
        className ?? ""
      }`.trim()}
      {...props}
    />
  );
}
