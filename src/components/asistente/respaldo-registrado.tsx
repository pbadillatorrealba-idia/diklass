import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { RespuestaConocimiento } from "@/components/conocimiento/respuesta-conocimiento";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { getQuery } from "@/features/conocimiento/consulta-service";
import { supabase } from "@/lib/supabase/client";

/**
 * «Ver respaldo registrado» de una respuesta de conocimiento (FR-020 · US5-AC5): reconstruye desde
 * `knowledge_queries` lo que produjo la recomendación, sin volver a consultar.
 */
export function RespaldoRegistrado({ queryId }: { queryId: string }) {
  const [abierto, setAbierto] = useState(false);
  const respaldo = useQuery({
    queryKey: ["conocimiento", "query", queryId],
    queryFn: () => getQuery(supabase, queryId),
    enabled: abierto,
  });
  return (
    <VStack className="gap-2">
      <Button
        className="self-start"
        onPress={() => setAbierto((valor) => !valor)}
        size="sm"
        testID={`ver-respaldo-${queryId}`}
        variant="ghost"
      >
        <ButtonText>{abierto ? "Ocultar respaldo" : "Ver respaldo registrado"}</ButtonText>
      </Button>
      {abierto && respaldo.data != null ? (
        <VStack className="gap-2 rounded-sm border border-border bg-card p-3">
          <Text tone="muted" variant="caption">
            Reconstrucción de lo que produjo esta recomendación (FR-020): consulta{" "}
            {respaldo.data.row.id}, paciente {respaldo.data.row.patient_id ?? "ninguno"}.
          </Text>
          <RespuestaConocimiento answer={respaldo.data.answer} />
        </VStack>
      ) : null}
    </VStack>
  );
}
