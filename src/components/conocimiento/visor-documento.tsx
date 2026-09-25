import { AttributionBadge } from "@/components/clinical/attribution-badge";
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
    fragmentoCitado,
  );

  return (
    <VStack className="gap-3" testID="visor-documento">
      <Box className="rounded-xl bg-muted p-4">
        <Text selectable variant="strong">
          {fuente.content.bibliografia.titulo}
        </Text>
        <Text selectable tone="muted" variant="caption">
          Autores: {fuente.content.bibliografia.autores.join(", ") || "sin autores registrados"}
        </Text>
        <Text tone="muted" variant="caption">
          Licencia: {fuente.content.licencia.tipo}
          {fuente.content.licencia.nota ? ` · ${fuente.content.licencia.nota}` : ""}
        </Text>
        <Text tone="muted" variant="caption">
          Incorporada el {new Date(fuente.record.created_at).toLocaleString("es-CL")}
        </Text>
        {fuente.record.status === "withdrawn" &&
        fuente.record.withdrawn_by !== null &&
        fuente.record.withdrawn_at !== null ? (
          <Box className="gap-1">
            <Text tone="destructive" variant="caption" testID="visor-fuente-retirada">
              Fuente retirada de la colección el{" "}
              {new Date(fuente.record.withdrawn_at).toLocaleString("es-CL", {
                dateStyle: "medium",
                timeStyle: "medium",
              })}
              ; sus citas previas siguen siendo identificables.
            </Text>
            <AttributionBadge
              attribution={{
                actorId: fuente.record.withdrawn_by,
                occurredAt: fuente.record.withdrawn_at,
                action: null,
              }}
            />
          </Box>
        ) : null}
      </Box>

      {contexto.fragmentos.map((fragmento) => (
        <Box
          className={`rounded-lg border p-3 ${
            fragmento.citado ? "border-primary bg-primary-surface" : "border-border bg-card"
          }`}
          key={fragmento.ordinal}
          testID={`visor-fragmento-${fragmento.ordinal}`}
        >
          <Text tone="muted" variant="label">
            Fragmento {fragmento.ordinal}
            {fragmento.seccion ? ` · ${fragmento.seccion}` : ""}
            {fragmento.citado ? " · fragmento citado" : ""}
          </Text>
          <Text selectable>{fragmento.texto}</Text>
        </Box>
      ))}

      {fragmentoCitado !== null ? (
        <Text tone="muted" variant="caption">
          El fragmento citado se muestra resaltado entre sus vecinos dentro del documento fuente.
        </Text>
      ) : null}
    </VStack>
  );
}
