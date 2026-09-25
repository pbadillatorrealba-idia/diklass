import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
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
  return (
    <Box
      accessibilityLabel="Avisos de cobertura de la respuesta"
      className="gap-2 rounded-lg border border-border bg-card p-3"
      testID="avisos-cobertura"
    >
      {cobertura.estado === "parcial" && cobertura.noCubiertos.length > 0 ? (
        <Text className="text-foreground text-sm" testID="cobertura-parcial">
          Queda sin cubrir por la evidencia recuperada: «{cobertura.noCubiertos.join(", ")}».
        </Text>
      ) : null}
      {avisos.map((aviso) => (
        <Text
          className={`text-sm ${
            aviso === "sin_respaldo_documental" ? "text-destructive" : "text-foreground"
          }`}
          key={aviso}
          testID={`aviso-${aviso}`}
        >
          {TEXTO_AVISO[aviso]}
        </Text>
      ))}
    </Box>
  );
}
