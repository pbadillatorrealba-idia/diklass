import { View } from "react-native";
import { ProvenanceKey } from "@/components/ui/provenance-mark";
import { Text } from "@/components/ui/text";

export type ConsultationHeaderProps = {
  patientName: string;
  /** `null` si la ficha no enlaza un tutor legible. */
  tutorName: string | null;
  /** Posición de la consulta entre las del paciente, por `created_at`; `null` si no se sabe. */
  ordinal: number | null;
  createdAt: string;
  status: "open" | "closed";
};

/**
 * Encabezado del formulario de la consulta (design.md D20 · US18-AC2): paciente, tutor, «Consulta
 * n.º N» y fecha en la mono de datos, con la clave de procedencia siempre visible. No agrega datos.
 */
export function ConsultationHeader({
  patientName,
  tutorName,
  ordinal,
  createdAt,
  status,
}: ConsultationHeaderProps) {
  const fecha = new Date(createdAt).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return (
    <View className="gap-3 border-b border-border pb-3" testID="consultation-header">
      <View className="flex-row flex-wrap gap-x-6 gap-y-2">
        <View className="gap-1">
          <Text variant="rubric">Paciente</Text>
          <Text selectable variant="strong">
            {patientName}
          </Text>
        </View>
        <View className="gap-1">
          <Text variant="rubric">Tutor</Text>
          {tutorName ? (
            <Text selectable>{tutorName}</Text>
          ) : (
            <Text tone="muted">Tutor no disponible</Text>
          )}
        </View>
        <View className="gap-1">
          <Text variant="rubric">Fecha</Text>
          <Text selectable variant="data">
            {fecha}
          </Text>
        </View>
        <View className="gap-1">
          <Text variant="rubric">Estado</Text>
          <Text testID="consultation-state">{status === "closed" ? "Cerrada" : "Abierta"}</Text>
        </View>
        {ordinal === null ? null : (
          <View className="justify-end">
            <Text variant="strong">
              {"Consulta n.º "}
              <Text className="font-semibold" variant="data">
                {String(ordinal)}
              </Text>
            </Text>
          </View>
        )}
      </View>
      <ProvenanceKey />
    </View>
  );
}
