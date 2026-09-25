import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { KnowledgeAnswer, SegmentoRespuesta } from "@/features/conocimiento/schema";
import { AvisosCobertura } from "./avisos-cobertura";
import { SegmentoRespuestaView } from "./segmento-respuesta";

const ORDEN_ORIGEN: Record<SegmentoRespuesta["kind"], number> = {
  evidencia: 0,
  ficha: 1,
  inferencia: 2,
};

/**
 * Respuesta del asistente agrupada por origen (FR-021 · US5-AC3) con sus avisos de cobertura
 * (FR-022/FR-023) y sus citas navegables (FR-007 · FR-030).
 */
export function RespuestaConocimiento({ answer }: { answer: KnowledgeAnswer }) {
  const segmentos = [...answer.segmentos].sort(
    (a, b) => ORDEN_ORIGEN[a.kind] - ORDEN_ORIGEN[b.kind],
  );

  return (
    <VStack className="gap-3" testID="respuesta-conocimiento">
      <AvisosCobertura cobertura={answer.cobertura} avisos={answer.avisos} />
      {segmentos.map((segmento) => (
        <SegmentoRespuestaView key={segmento.id} segmento={segmento} />
      ))}
      <Box className="rounded-lg bg-muted p-2">
        <Text tone="muted" variant="caption">
          Lo documental va citado; lo de la ficha, etiquetado como ficha; lo derivado por el
          sistema, como inferencia. Toda decisión clínica es del profesional (FR-010).
        </Text>
      </Box>
    </VStack>
  );
}
