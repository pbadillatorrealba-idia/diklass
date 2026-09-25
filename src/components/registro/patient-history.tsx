import { Link } from "expo-router";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { QueryState } from "@/components/ui/query-state";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
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
    <VStack className="w-full gap-3" testID="patient-history">
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
        {entries.map((entry) => {
          const openedAt = new Date(entry.openedAt).toLocaleString("es-CL");
          return (
            <Card key={entry.consultationId} testID="history-item">
              <Text variant="strong">Consulta del {openedAt}</Text>
              <Text>{entry.status === "closed" ? "Cerrada" : "Abierta"}</Text>
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
                  testID="history-open"
                >
                  <ButtonText>Ver consulta</ButtonText>
                </Button>
              </Link>
            </Card>
          );
        })}
      </QueryState>
    </VStack>
  );
}
