import { Text, type TextProps } from "./text";

/**
 * Enlace en línea (FR-084 · design.md D13), siempre dentro de `<Link href asChild>`, que le pasa
 * `href`, el rol y la navegación. Subrayado además de `primary`: el color no es la única señal.
 */
export function LinkText({ className, ...props }: Omit<TextProps, "tone">) {
  return <Text className={`underline ${className ?? ""}`.trim()} tone="primary" {...props} />;
}
