import { Callout, type CalloutTone } from "@/components/ui/callout";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { AvisoRespuesta, Cobertura } from "@/features/conocimiento/schema";

const TEXTO_AVISO: Record<AvisoRespuesta, string> = {
  sin_respaldo_documental:
    "No dispongo de evidencia documental para esta pregunta. La colección cubre etología veterinaria canina; no presento ninguna afirmación clínica sin respaldo.",
  cobertura_parcial: "La evidencia disponible responde solo una parte de la pregunta.",
  fuentes_multiples:
    "Hay más de una fuente con indicaciones sobre lo consultado: se muestran todas con su cita, sin elegir entre ellas.",
  sin_paciente_seleccionado:
    "Sin paciente seleccionado: respuesta sobre conocimiento general, sin datos de ningún paciente.",
  fuente_retirada:
    "Una cita apunta a una fuente retirada de la colección; la referencia sigue identificable.",
  evidencia_truncada:
    "Había más evidencia recuperada que el tope de referencias mostradas: no se muestra todo lo recuperado.",
  cita_irresoluble:
    "Una o más citas de esta respuesta ya no resuelven contra la colección actual; se conservan tal como se registraron.",
  ficha_no_disponible:
    "El paciente está seleccionado, pero su ficha no pudo leerse: la respuesta no incluye datos de ficha.",
};

/**
 * Estado de cada aviso (FR-075): la ausencia de respaldo es un error; responder sin paciente es
 * informativo; el resto advierte de una respuesta incompleta o de citas a revisar.
 */
const TONO_AVISO: Record<AvisoRespuesta, CalloutTone> = {
  sin_respaldo_documental: "error",
  cobertura_parcial: "warning",
  fuentes_multiples: "warning",
  sin_paciente_seleccionado: "info",
  fuente_retirada: "warning",
  evidencia_truncada: "warning",
  cita_irresoluble: "warning",
  ficha_no_disponible: "warning",
};

/**
 * Avisos explícitos de la respuesta (FR-022, FR-023, FR-051, FR-052 y FR-053 · US5-AC2/AC8/
 * AC10/AC11/AC12): ausencia de respaldo, qué parte de la pregunta queda sin cubrir, fuentes
 * sin arbitraje, modo sin paciente y citas a fuentes retiradas.
 */
export function AvisosCobertura({
  cobertura,
  avisos,
}: {
  cobertura: Cobertura;
  avisos: AvisoRespuesta[];
}) {
  const noCubiertos = cobertura.estado === "parcial" ? cobertura.noCubiertos : [];
  // El aviso de cobertura parcial y el detalle de lo no cubierto son un mismo mensaje.
  const parcial = avisos.includes("cobertura_parcial") || noCubiertos.length > 0;
  return (
    <VStack className="gap-2" testID="avisos-cobertura">
      {parcial ? (
        <Callout testID="aviso-cobertura_parcial" title="Cobertura parcial" tone="warning">
          <Text>{TEXTO_AVISO.cobertura_parcial}</Text>
          {noCubiertos.length > 0 ? (
            <Text testID="cobertura-parcial">
              Queda sin cubrir por la evidencia recuperada: «{noCubiertos.join(", ")}».
            </Text>
          ) : null}
        </Callout>
      ) : null}
      {avisos
        .filter((aviso) => aviso !== "cobertura_parcial")
        .map((aviso) => (
          <Callout key={aviso} testID={`aviso-${aviso}`} tone={TONO_AVISO[aviso]}>
            {TEXTO_AVISO[aviso]}
          </Callout>
        ))}
    </VStack>
  );
}
