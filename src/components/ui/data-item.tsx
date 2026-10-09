import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";

/**
 * Dato destacado de la cabecera: rótulo arriba y valor en la mono de datos debajo. `value` puede ser
 * un nodo (p. ej. un enlace); `null` = «Sin dato».
 */
export function DataItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View className="w-full gap-1 sm:w-1/2 lg:w-1/4">
      <Text tone="muted" variant="label">
        {label}
      </Text>
      {value == null ? (
        <Text tone="muted">Sin dato</Text>
      ) : typeof value === "string" ? (
        <Text selectable variant="data">
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/** Grupo de datos con subtítulo: una columna en móvil, dos en tablet y cuatro en escritorio. */
export function DataGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <VStack className="gap-3 border-border border-t pt-4">
      <Text variant="rubric">{title}</Text>
      <View className="flex-row flex-wrap gap-y-4">{children}</View>
    </VStack>
  );
}
