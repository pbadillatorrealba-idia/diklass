import { Pressable } from "react-native";
import { Text } from "@/components/ui/text";

/**
 * Primer elemento enfocable de la app (WCAG 2.4.1 · design.md D12): salta la navegación y lleva
 * el foco al contenido. Solo es visible con el foco, y solo existe en web. También sirve de
 * atajo a otras zonas del shell («Ir al asistente»), con su propia posición.
 */
export function SkipLink({
  className = "left-2",
  label = "Saltar al contenido",
  targetId,
  testID = `skip-${targetId}`,
}: {
  /** Posición (y visibilidad) de la zona del shell a la que salta. */
  className?: string;
  label?: string;
  targetId: string;
  /** Identidad de la parada en el recorrido por teclado: cada atajo necesita la suya. */
  testID?: string;
}) {
  const link = { href: `#${targetId}` } as object;
  return (
    <Pressable
      {...link}
      // Sin foco no recibe clics: queda invisible encima de la marca de la barra superior.
      className={`pointer-events-none absolute ${className} top-2 z-10 rounded-sm bg-card px-4 py-2 opacity-0 focus:pointer-events-auto focus:opacity-100`}
      onPress={(event) => {
        event.preventDefault();
        const target = document.getElementById(targetId);
        target?.focus();
      }}
      role="link"
      testID={testID}
    >
      <Text variant="strong">{label}</Text>
    </Pressable>
  );
}
