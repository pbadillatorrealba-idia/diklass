import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { ConsultationHistoryEntry } from "@/features/registro/summaries";

type PatientHistoryProps = {
  entries: ConsultationHistoryEntry[];
  onOpen: (consultationId: string) => void;
};

/**
 * Historial cronológico de consultas del paciente (FR-002 · SC-014 · US4-AC4): el orden lo
 * resuelve `buildPatientHistory` y cada entrada abre su consulta. Un borrador de epicrisis
 * nunca figura aquí; solo la versión efectiva, marcada si corrige una anterior (FR-010,
 * FR-024).
 */
export function PatientHistory({ entries, onOpen }: PatientHistoryProps) {
  return (
    <VStack className="w-full gap-3" testID="patient-history">
      <Heading size="lg">Historial de consultas</Heading>
      {entries.length === 0 ? (
        <Text testID="history-empty">Sin consultas registradas para este paciente.</Text>
      ) : (
        entries.map((entry) => {
          const openedAt = new Date(entry.openedAt).toLocaleString("es-CL");
          return (
            <Box
              className="rounded-xl border border-border bg-white p-4"
              key={entry.consultationId}
              testID="history-item"
            >
              <Text bold>Consulta del {openedAt}</Text>
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
              <Button
                accessibilityLabel={`Ver la consulta del ${openedAt}`}
                onPress={() => onOpen(entry.consultationId)}
                testID="history-open"
              >
                <ButtonText>Ver consulta</ButtonText>
              </Button>
            </Box>
          );
        })
      )}
    </VStack>
  );
}
