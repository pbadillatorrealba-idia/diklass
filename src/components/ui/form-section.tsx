import type { ReactNode } from "react";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { CONTINUOUS_CURVE } from "./border-curve";

export type FormSectionProps = {
  number: number;
  title: string;
  /** Sección con foco o la última editada (D20): banda en `primary` sólido. */
  active?: boolean;
  /** Capa bajo el contenido del cuerpo, p. ej. el pliego que se funde a papel al firmar. */
  underlay?: ReactNode;
  children: ReactNode;
  testID?: string;
};

/**
 * Sección numerada del formulario de la consulta (design.md D20): número y título en la banda
 * preimpresa y el cuerpo sobre la hoja con reglas de 1 px. La numeración es la del protocolo; la
 * sección activa se marca con la banda sólida, nunca con un borde lateral.
 */
export function FormSection({
  number,
  title,
  active = false,
  underlay,
  children,
  testID,
}: FormSectionProps) {
  const ink = active ? "text-primary-foreground" : "text-primary";
  return (
    <View
      className="w-full overflow-hidden rounded-sm border border-border bg-card"
      style={CONTINUOUS_CURVE}
      testID={testID}
    >
      <View
        className={`border-b border-border px-4 py-2 ${active ? "bg-primary" : "bg-primary-surface"}`}
        testID={testID ? `${testID}-band` : undefined}
      >
        <Heading className={ink} level={2}>
          <Text className="font-semibold" tone={active ? "onPrimary" : "primary"} variant="data">
            {String(number)}
          </Text>
          {`  ${title}`}
        </Heading>
      </View>
      <View className="relative">
        {underlay}
        <View className="gap-4 p-4">{children}</View>
      </View>
    </View>
  );
}
