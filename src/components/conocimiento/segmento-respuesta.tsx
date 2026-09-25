import { Box } from "@/components/ui/box";
import { SuggestedBlock } from "@/components/ui/suggested-block";
import { Text } from "@/components/ui/text";
import type { SegmentoRespuesta } from "@/features/conocimiento/schema";
import { CitaFragmento } from "./cita-fragmento";

const ETIQUETA_ORIGEN: Record<SegmentoRespuesta["kind"], string> = {
  evidencia: "Fuente documental · recuperada",
  ficha: "Ficha clínica",
  inferencia: "Inferencia del sistema",
};

const COLOR_ORIGEN: Record<Exclude<SegmentoRespuesta["kind"], "inferencia">, string> = {
  evidencia: "bg-primary-surface",
  ficha: "bg-secondary-surface",
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

  const contenido = (
    <>
      <Text tone="muted" variant="label">
        {etiqueta}
      </Text>
      <Text>
        {segmento.texto}
        {segmento.kind === "ficha" && segmento.provenance !== "desconocida"
          ? ` (${segmento.fichaRef})`
          : ""}
      </Text>
      {segmento.kind === "evidencia" ? <CitaFragmento cita={segmento.cita} /> : null}
    </>
  );

  // Una inferencia es una afirmación del propio sistema, sin validar: se marca como sugerencia
  // (FR-076). La evidencia citada y el dato de ficha conservan su tinte de origen.
  if (segmento.kind === "inferencia") {
    return <SuggestedBlock testID={`segmento-${segmento.id}`}>{contenido}</SuggestedBlock>;
  }
  return (
    <Box
      className={`gap-1 rounded-lg p-3 ${COLOR_ORIGEN[segmento.kind]}`}
      testID={`segmento-${segmento.id}`}
    >
      {contenido}
    </Box>
  );
}
