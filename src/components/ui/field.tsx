import type { ReactNode } from "react";
import { View } from "react-native";
import { ProvenanceMark } from "@/components/ui/provenance-mark";
import { Text } from "@/components/ui/text";
import type { Provenance } from "@/features/registro/schema";

export type FieldProps = {
  /** Rótulo preimpreso del campo (variante `rubric`). */
  label: string;
  /** Valor: un texto se muestra copiable (D14); cualquier otro nodo se pinta tal cual. */
  children: ReactNode;
  /** Solo cuando el dato tiene procedencia en el modelo (FR-021; hoy, la anamnesis). */
  provenance?: Provenance;
  /** Marca al margen propia, p. ej. la procedencia corregida; sustituye a `provenance`. */
  mark?: ReactNode;
  testID?: string;
};

/**
 * Campo del formulario (design.md D20): rótulo preimpreso y valor sobre una regla de 1 px, con el
 * código de procedencia al margen cuando existe (FR-097).
 */
export function Field({ label, children, provenance, mark, testID }: FieldProps) {
  const margin = mark ?? (provenance ? <ProvenanceMark provenance={provenance} /> : null);
  return (
    <View className="flex-row items-start gap-3 border-b border-border py-2" testID={testID}>
      <View className="flex-1 gap-1">
        <Text variant="rubric">{label}</Text>
        {typeof children === "string" ? <Text selectable>{children}</Text> : children}
      </View>
      {margin ? (
        // Tope del margen: una historia de correcciones larga salta de línea en vez de apretar el
        // valor a 320 px (revisión de la PR #41).
        <View
          className="max-w-[40%] shrink items-end"
          testID={testID ? `${testID}-margin` : undefined}
        >
          {margin}
        </View>
      ) : null}
    </View>
  );
}
