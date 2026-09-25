import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import type { SegmentoRespuesta } from "@/features/conocimiento/schema";
import { CitaFragmento } from "./cita-fragmento";

const ETIQUETA_ORIGEN: Record<SegmentoRespuesta["kind"], string> = {
  evidencia: "Fuente documental · recuperada",
  ficha: "Ficha clínica",
  inferencia: "Inferencia del sistema",
};

const COLOR_ORIGEN: Record<SegmentoRespuesta["kind"], string> = {
  evidencia: "bg-primary/15",
  ficha: "bg-secondary/15",
  inferencia: "bg-accent/20",
};

/**
 * Segmento de la respuesta con su origen visiblemente distinguido (FR-021 · US5-AC3):
 * evidencia documental citada (recuperada), dato de la ficha clínica (reportada o
 * desconocida) o derivación del sistema (inferida).
 */
export function SegmentoRespuestaView({ segmento }: { segmento: SegmentoRespuesta }) {
  const etiqueta =
    segmento.kind === "ficha"
      ? `${ETIQUETA_ORIGEN.ficha} · ${segmento.provenance}`
      : ETIQUETA_ORIGEN[segmento.kind];

  return (
    <Box
      accessibilityLabel={`${etiqueta}: ${segmento.texto}`}
      className={`rounded-lg p-3 ${COLOR_ORIGEN[segmento.kind]}`}
      testID={`segmento-${segmento.id}`}
    >
      <Text bold className="text-foreground/70 text-xs">
        {etiqueta}
      </Text>
      {segmento.kind === "ficha" ? (
        <Text className="text-foreground text-sm">
          {segmento.texto}
          {segmento.provenance === "desconocida" ? "" : ` (${segmento.fichaRef})`}
        </Text>
      ) : (
        <Text className="text-foreground text-sm">{segmento.texto}</Text>
      )}
      {segmento.kind === "evidencia" ? <CitaFragmento cita={segmento.cita} /> : null}
    </Box>
  );
}
