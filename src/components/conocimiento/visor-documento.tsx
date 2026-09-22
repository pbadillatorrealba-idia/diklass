import { Box } from "@/components/ui/box";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { buildFragmentContext } from "@/features/conocimiento/answer";
import type { FuenteEntry } from "@/features/conocimiento/coleccion-service";

/**
 * Visor de la fuente con el fragmento citado dentro de su contexto (FR-007 · US5-AC7): la
 * cabecera bibliográfica del documento (FR-030) y los fragmentos vecinos, con el citado
 * resaltado. Una fuente retirada se declara y su contenido sigue legible (FR-053).
 */
export function VisorDocumento({
  fuente,
  fragmentoCitado = null,
}: {
  fuente: FuenteEntry;
  fragmentoCitado?: number | null;
}) {
  const contexto = buildFragmentContext(
    {
      bibliografia: fuente.content.bibliografia,
      licencia: fuente.content.licencia,
      estado: fuente.record.status === "withdrawn" ? "withdrawn" : "available",
      fragmentos: fuente.content.fragmentos,
    },
    fragmentoCitado ?? 0,
  );

  return (
    <VStack className="gap-3" testID="visor-documento">
      <Box className="rounded-lg bg-muted p-3">
        <Text bold className="text-foreground">
          {fuente.content.bibliografia.titulo}
        </Text>
        <Text className="text-foreground/70 text-sm">
          Autores: {fuente.content.bibliografia.autores.join(", ") || "sin autores registrados"}
        </Text>
        <Text className="text-foreground/70 text-sm">
          Licencia: {fuente.content.licencia.tipo}
          {fuente.content.licencia.nota ? ` · ${fuente.content.licencia.nota}` : ""}
        </Text>
        <Text className="text-foreground/70 text-sm">
          Incorporada el {new Date(fuente.record.created_at).toLocaleString("es-CL")}
        </Text>
        {fuente.record.status === "withdrawn" && fuente.record.withdrawn_at !== null ? (
          <Text className="text-destructive text-sm" testID="visor-fuente-retirada">
            Fuente retirada de la colección el{" "}
            {new Date(fuente.record.withdrawn_at).toLocaleString("es-CL")}; sus citas previas siguen
            siendo identificables.
          </Text>
        ) : null}
      </Box>

      {contexto.fragmentos.map((fragmento) => (
        <Box
          className={`rounded-lg border p-3 ${
            fragmento.citado ? "border-primary bg-amber-100" : "border-border bg-white"
          }`}
          key={fragmento.ordinal}
          testID={`visor-fragmento-${fragmento.ordinal}`}
        >
          <Text bold className="text-foreground/70 text-xs">
            Fragmento {fragmento.ordinal}
            {fragmento.seccion ? ` · ${fragmento.seccion}` : ""}
            {fragmento.citado ? " · fragmento citado" : ""}
          </Text>
          <Text className="text-foreground text-sm">{fragmento.texto}</Text>
        </Box>
      ))}

      {fragmentoCitado !== null ? (
        <Text className="text-foreground/70 text-xs">
          El fragmento citado se muestra resaltado entre sus vecinos dentro del documento fuente.
        </Text>
      ) : null}
    </VStack>
  );
}
