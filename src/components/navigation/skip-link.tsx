import { Pressable } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Primer elemento enfocable de la app (WCAG 2.4.1 · design.md D12): salta la navegación y lleva
 * el foco al contenido. Solo es visible con el foco, y solo existe en web.
 */
export function SkipLink({ targetId }: { targetId: string }) {
  const link = { href: `#${targetId}` } as object;
  return (
    <Pressable
      {...link}
      className="absolute left-2 top-2 z-10 rounded-lg bg-card px-4 py-2 opacity-0 focus:opacity-100"
      onPress={(event) => {
        event.preventDefault();
        const target = document.getElementById(targetId);
        target?.focus();
      }}
      role="link"
    >
      <Text variant="strong">Saltar al contenido</Text>
    </Pressable>
  );
}
