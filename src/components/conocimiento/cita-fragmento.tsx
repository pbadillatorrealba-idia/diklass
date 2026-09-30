import { Link } from "expo-router";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { Cita } from "@/features/conocimiento/schema";

function lineaBibliografica(cita: Cita): string {
  const autores = cita.bibliografia.autores.join(", ");
  const anio = cita.bibliografia.anio !== null ? ` (${cita.bibliografia.anio})` : "";
  const revista = cita.bibliografia.revista ? `. ${cita.bibliografia.revista}` : "";
  return `${autores}${anio}. ${cita.bibliografia.titulo}${revista}`;
}

/**
 * Cita documento+fragmento con su referencia bibliográfica (FR-007, FR-030 · US5-AC1/AC7/AC9).
 * Abrir la cita lleva al fragmento dentro de su documento fuente; una fuente retirada sigue
 * siendo identificable y así se declara (FR-053 · US5-AC12).
 */
export function CitaFragmento({ cita }: { cita: Cita }) {
  const retirada = cita.estado === "withdrawn";

  return (
    <Box
      accessibilityLabel={`Cita de ${cita.bibliografia.titulo}, fragmento ${cita.fragmentoOrdinal}`}
      className="mt-2 gap-1 rounded-lg border border-border bg-card p-3"
      testID={`cita-${cita.documentoId}-${cita.fragmentoOrdinal}`}
    >
      <Text selectable variant="label">
        {cita.bibliografia.titulo}
      </Text>
      <Text selectable tone="muted" variant="caption">
        {lineaBibliografica(cita)}
      </Text>
      <Text tone="muted" variant="caption">
        Fragmento {cita.fragmentoOrdinal} · Licencia: {cita.licencia.tipo}
      </Text>
      {retirada ? (
        <Text tone="destructive" variant="caption" testID="cita-fuente-retirada">
          Fuente retirada de la colección; la referencia sigue identificable.
        </Text>
      ) : null}
      <Link
        asChild
        href={{
          pathname: "/knowledge/sources/[id]",
          params: { id: cita.documentoId, fragmento: String(cita.fragmentoOrdinal) },
        }}
      >
        <Button
          className="self-start"
          size="sm"
          testID={`ver-contexto-${cita.documentoId}-${cita.fragmentoOrdinal}`}
          variant="ghost"
        >
          <ButtonText>Ver fragmento en su contexto</ButtonText>
        </Button>
      </Link>
    </Box>
  );
}
