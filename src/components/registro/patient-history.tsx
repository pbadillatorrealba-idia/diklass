import { Link } from "expo-router";
import { View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Heading } from "@/components/ui/heading";
import { QueryState } from "@/components/ui/query-state";
import { Text } from "@/components/ui/text";
import type { ConsultationHistoryEntry } from "@/features/registro/summaries";

type PatientHistoryProps = {
  entries: ConsultationHistoryEntry[];
  /** Estado de la lectura (FR-085): el vacío no se muestra mientras carga. */
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
};

/**
 * Historial cronológico de consultas del paciente (FR-002 · SC-014 · US4-AC4): el orden lo
 * resuelve `buildPatientHistory` y cada entrada abre su consulta. Un borrador de epicrisis
 * nunca figura aquí; solo la versión efectiva, marcada si corrige una anterior (FR-010,
 * FR-024).
 */
export function PatientHistory({ entries, error, isPending, onRetry }: PatientHistoryProps) {
  return (
    <Card className="gap-4" testID="patient-history">
      <Heading level={2}>Historial de consultas</Heading>
      <QueryState
        empty={<Text testID="history-empty">Sin consultas registradas para este paciente.</Text>}
        error={error}
        errorMessage="No pudimos cargar el historial de consultas."
        isEmpty={entries.length === 0}
        isPending={isPending}
        onRetry={onRetry}
        testID="history"
      >
        {entries.map((entry, index) => {
          const openedAt = new Date(entry.openedAt).toLocaleString("es-CL");
          return (
            <View className="flex-row gap-3" key={entry.consultationId} testID="history-item">
              {/* Riel de la línea de tiempo: punto por estado y hilo hasta la entrada siguiente. */}
              <View className="items-center">
                <View
                  className={`mt-2 size-3 rounded-sm ${entry.status === "closed" ? "bg-primary" : "bg-warning"}`}
                />
                {index < entries.length - 1 ? <View className="w-px flex-1 bg-border" /> : null}
              </View>
              <View className="flex-1 items-start gap-1 pb-6">
                <Text variant="strong">
                  Consulta del <Text variant="data">{openedAt}</Text>
                </Text>
                <Chip tone={entry.status === "closed" ? "success" : "warning"}>
                  {entry.status === "closed" ? "Cerrada" : "Abierta"}
                </Chip>
                {entry.epicrisis ? (
                  <Text testID="history-epicrisis">
                    Diagnóstico registrado:{" "}
                    {entry.epicrisis.diagnostico.trim() === ""
                      ? "sin diagnóstico en la epicrisis"
                      : entry.epicrisis.diagnostico}
                  </Text>
                ) : (
                  <Text>Sin epicrisis aprobada</Text>
                )}
                {entry.epicrisisSuperseded ? (
                  <Text>Corregida: la versión original permanece registrada.</Text>
                ) : null}
                <Link asChild href={`/consultations/${entry.consultationId}`}>
                  <Button
                    accessibilityLabel={`Ver la consulta del ${openedAt}`}
                    size="sm"
                    testID="history-open"
                    variant="outline"
                  >
                    <ButtonText>Ver consulta</ButtonText>
                  </Button>
                </Link>
              </View>
            </View>
          );
        })}
      </QueryState>
    </Card>
  );
}
