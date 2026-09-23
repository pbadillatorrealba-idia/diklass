import { CitaFragmento } from "@/components/conocimiento/cita-fragmento";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type { HipotesisSoportada } from "@/features/asistencia/schema";

/**
 * Reconstrucción de una hipótesis (FR-020 · US8-AC8): los antecedentes del paciente con sus
 * referencias y procedencias, los términos que dispararon la regla y las fuentes citadas que la
 * produjeron (FR-007).
 */
export function VerRespaldo({ hipotesis }: { hipotesis: HipotesisSoportada }) {
  return (
    <VStack
      className="gap-2 rounded-lg border border-border bg-muted p-3"
      testID={`ver-respaldo-${hipotesis.key}`}
    >
      <Text bold className="text-foreground text-sm">
        Qué produjo esta hipótesis (reconstrucción)
      </Text>
      {hipotesis.reglaId !== null ? (
        <Text className="text-foreground/70 text-xs">Regla aplicada: {hipotesis.reglaId}</Text>
      ) : (
        <Text className="text-foreground/70 text-xs">Candidatura aportada por el veterinario.</Text>
      )}
      {hipotesis.insumos.terminosMatch.length > 0 ? (
        <Text className="text-foreground/70 text-xs" testID={`terminos-${hipotesis.key}`}>
          Términos que dispararon la regla: {hipotesis.insumos.terminosMatch.join(", ")}
        </Text>
      ) : null}
      {hipotesis.insumos.anamnesis.map((insumo) => (
        <Text className="text-foreground/70 text-xs" key={insumo.recordId}>
          [anamnesis · {insumo.recordId} · {insumo.field} · procedencia {insumo.provenance} ·{" "}
          {insumo.papel === "aFavor" ? "a favor" : "en contra"}] {insumo.text}
        </Text>
      ))}
      {hipotesis.insumos.ficha.map((insumo) => (
        <Text className="text-foreground/70 text-xs" key={insumo.fichaRef}>
          [ficha · {insumo.fichaRef} · procedencia reportada ·{" "}
          {insumo.papel === "aFavor" ? "a favor" : "en contra"}] {insumo.valor ?? "sin dato"}
        </Text>
      ))}
      {hipotesis.respaldo.knowledgeQueryId !== null ? (
        <Text className="text-foreground/70 text-xs">
          Respalo documental registrado como consulta {hipotesis.respaldo.knowledgeQueryId}.
        </Text>
      ) : null}
      {hipotesis.respaldo.citas.map((cita) => (
        <CitaFragmento cita={cita} key={`${cita.documentoId}-${cita.fragmentoOrdinal}`} />
      ))}
    </VStack>
  );
}
