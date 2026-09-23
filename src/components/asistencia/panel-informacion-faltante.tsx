import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { SugerenciaPresentada } from "@/features/asistencia/asistencia-service";
import type { DecisionSugerencia } from "@/features/asistencia/schema";
import { TarjetaSugerencia } from "./tarjeta-sugerencia";

/**
 * Panel de información faltante de la consulta (FR-008 · FR-033 · US7): preguntas sugeridas con
 * su fundamento y su estado, con las decisiones registradas por el veterinario.
 */
export function PanelInformacionFaltante({
  sugerencias,
  onDecidir,
}: {
  sugerencias: SugerenciaPresentada[];
  onDecidir: (sugerencia: SugerenciaPresentada, estado: DecisionSugerencia) => void;
}) {
  return (
    <VStack className="gap-3" testID="panel-informacion-faltante">
      <Heading size="md">Información faltante</Heading>
      <Text className="text-foreground/70 text-sm">
        Antecedentes aún no recopilados con preguntas sugeridas. Cada sugerencia indica si se apoya
        en un protocolo cargado o en criterio general, y toda decisión queda registrada.
      </Text>
      {sugerencias.length === 0 ? (
        <Text className="text-foreground/70 text-sm" testID="faltantes-vacio">
          Sin sugerencias pendientes: lo detectado ya está cubierto o decidido en esta consulta.
        </Text>
      ) : (
        sugerencias.map((sugerencia) => (
          <TarjetaSugerencia
            key={sugerencia.key}
            onDecidir={(estado) => onDecidir(sugerencia, estado)}
            sugerencia={sugerencia}
          />
        ))
      )}
    </VStack>
  );
}
