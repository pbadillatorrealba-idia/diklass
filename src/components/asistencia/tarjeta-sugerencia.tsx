import { CitaFragmento } from "@/components/conocimiento/cita-fragmento";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { SugerenciaPresentada } from "@/features/asistencia/asistencia-service";
import type { DecisionSugerencia } from "@/features/asistencia/schema";

/**
 * Sugerencia de información faltante con su fundamento y su decisión registrable
 * (FR-008 · FR-033 · US7-AC2/AC3/AC5/AC6): la cita lleva al fragmento concreto de su fuente y
 * el criterio general se declara explícitamente, nunca disfrazado de protocolo.
 */

const ETIQUETAS_ESTADO: Record<SugerenciaPresentada["estado"], string> = {
  pendiente: "Pendiente",
  formulada: "Formulada",
  ignorada: "Ignorada",
  no_aplicable: "No aplicable",
};

export function TarjetaSugerencia({
  sugerencia,
  onDecidir,
}: {
  sugerencia: SugerenciaPresentada;
  onDecidir: (estado: DecisionSugerencia) => void;
}) {
  const pendiente = sugerencia.estado === "pendiente";

  return (
    <Box
      accessibilityLabel={`Sugerencia: ${sugerencia.pregunta}. Estado: ${ETIQUETAS_ESTADO[sugerencia.estado]}.`}
      className="rounded-lg border border-border bg-white p-3"
      testID={`sugerencia-${sugerencia.key}`}
    >
      <VStack className="gap-2">
        <Text bold className="text-foreground">
          {sugerencia.pregunta}
        </Text>
        <Text className="text-foreground/70 text-sm" testID={`estado-${sugerencia.key}`}>
          Estado: {ETIQUETAS_ESTADO[sugerencia.estado]}
        </Text>
        {sugerencia.fundamento.kind === "fuente" ? (
          <CitaFragmento cita={sugerencia.fundamento.cita} />
        ) : (
          <Text
            className="text-foreground/70 text-sm"
            testID={`criterio-general-${sugerencia.key}`}
          >
            Fundamento: criterio general del equipo clínico; no se apoya en un protocolo cargado.
          </Text>
        )}
        {pendiente ? (
          <VStack className="gap-2">
            <Button
              className="self-start"
              onPress={() => onDecidir("formulada")}
              testID={`formulada-${sugerencia.key}`}
            >
              <ButtonText>Marcar como formulada</ButtonText>
            </Button>
            <Button
              className="self-start"
              onPress={() => onDecidir("no_aplicable")}
              testID={`no-aplicable-${sugerencia.key}`}
            >
              <ButtonText>Marcar como no aplicable</ButtonText>
            </Button>
            <Button
              className="self-start"
              onPress={() => onDecidir("ignorada")}
              testID={`ignorar-${sugerencia.key}`}
            >
              <ButtonText>Ignorar</ButtonText>
            </Button>
          </VStack>
        ) : (
          <Text className="text-foreground/70 text-xs">
            Decisión registrada en esta consulta (la sugerencia no vuelve a proponerse aquí).
          </Text>
        )}
      </VStack>
    </Box>
  );
}
