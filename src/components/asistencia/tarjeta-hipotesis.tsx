import { useState } from "react";
import { CitaFragmento } from "@/components/conocimiento/cita-fragmento";
import { Box } from "@/components/ui/box";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import type {
  HipotesisSoportada,
  ItemAnalisis,
  SeccionAnalisis,
} from "@/features/asistencia/schema";
import { etiquetaEstadoHipotesis } from "@/features/asistencia/soporte-diferencial";
import { VerRespaldo } from "./ver-respaldo";

/**
 * Hipótesis clínica como apoyo a la decisión (FR-009 · FR-010 · FR-029 · SC-019 · SC-030 ·
 * SC-031 · US8): a favor, en contra (o su ausencia explícita), información faltante, evidencia
 * citada con su fragmento, declaración de ausencia de respaldo y descargo constante. Nunca se
 * presenta como diagnóstico definitivo.
 */

function LineaInsumo({ item }: { item: ItemAnalisis }) {
  return (
    <Text className="text-foreground/70 text-xs">
      [{item.ref} · {item.campo} · procedencia {item.provenance}] {item.texto}
    </Text>
  );
}

function Seccion({
  titulo,
  seccion,
  testID,
}: {
  titulo: string;
  seccion: SeccionAnalisis;
  testID: string;
}) {
  return (
    <VStack className="gap-1" testID={testID}>
      <Text bold className="text-foreground text-sm">
        {titulo}
      </Text>
      {seccion.items.map((item) => (
        <LineaInsumo item={item} key={`${item.ref}-${item.campo}-${item.papel}`} />
      ))}
      {seccion.ausencia !== null ? (
        <Text className="text-foreground/70 text-xs">{seccion.ausencia}</Text>
      ) : null}
    </VStack>
  );
}

export function TarjetaHipotesis({
  hipotesis,
  onDecidir,
}: {
  hipotesis: HipotesisSoportada;
  onDecidir: (decision: "accepted" | "discarded") => void;
}) {
  const [respaldoAbierto, setRespaldoAbierto] = useState(false);

  return (
    <Box
      accessibilityLabel={`Hipótesis ${hipotesis.texto}, estado ${etiquetaEstadoHipotesis(hipotesis.decision)}. ${hipotesis.descargo}`}
      className="rounded-lg border border-border bg-white p-3"
      testID={`hipotesis-${hipotesis.key}`}
    >
      <VStack className="gap-2">
        <Text bold className="text-foreground">
          {hipotesis.texto}
        </Text>
        <Text className="text-foreground/70 text-sm" testID={`estado-${hipotesis.key}`}>
          Estado: {etiquetaEstadoHipotesis(hipotesis.decision)} · Origen:{" "}
          {hipotesis.origen === "sistema"
            ? "propuesta por el sistema"
            : "aportada por el veterinario"}
        </Text>

        <Seccion
          seccion={hipotesis.analisis.aFavor}
          testID={`a-favor-${hipotesis.key}`}
          titulo="Antecedentes a favor"
        />
        <Seccion
          seccion={hipotesis.analisis.enContra}
          testID={`en-contra-${hipotesis.key}`}
          titulo="Antecedentes en contra"
        />
        <VStack className="gap-1" testID={`faltante-${hipotesis.key}`}>
          <Text bold className="text-foreground text-sm">
            Información faltante para evaluarla
          </Text>
          {hipotesis.analisis.faltante.campos.map((campo) => (
            <Text className="text-foreground/70 text-xs" key={campo}>
              {campo}
            </Text>
          ))}
          {hipotesis.analisis.faltante.ausencia !== null ? (
            <Text className="text-foreground/70 text-xs">
              {hipotesis.analisis.faltante.ausencia}
            </Text>
          ) : null}
        </VStack>

        {hipotesis.respaldo.sinRespaldo ? (
          <Text className="text-destructive text-sm" testID={`sin-respaldo-${hipotesis.key}`}>
            Sin respaldo documental disponible en la colección de etología veterinaria canina: la
            hipótesis se presenta sin evidencia citada y así se declara.
          </Text>
        ) : (
          <VStack className="gap-1">
            <Text bold className="text-foreground text-sm">
              Evidencia documental
            </Text>
            {hipotesis.respaldo.citas.map((cita) => (
              <CitaFragmento cita={cita} key={`${cita.documentoId}-${cita.fragmentoOrdinal}`} />
            ))}
          </VStack>
        )}

        <Text className="text-muted-foreground text-xs italic" testID={`descargo-${hipotesis.key}`}>
          {hipotesis.descargo}
        </Text>

        <Button
          className="self-start"
          onPress={() => onDecidir("accepted")}
          testID={`aceptar-${hipotesis.key}`}
        >
          <ButtonText>Aceptar</ButtonText>
        </Button>
        <Button
          className="self-start"
          onPress={() => onDecidir("discarded")}
          testID={`descartar-${hipotesis.key}`}
        >
          <ButtonText>Descartar</ButtonText>
        </Button>
        <Button
          className="self-start"
          onPress={() => setRespaldoAbierto(!respaldoAbierto)}
          testID={`toggle-respaldo-${hipotesis.key}`}
        >
          <ButtonText>{respaldoAbierto ? "Ocultar respaldo" : "Ver respaldo"}</ButtonText>
        </Button>
        {respaldoAbierto ? <VerRespaldo hipotesis={hipotesis} /> : null}
      </VStack>
    </Box>
  );
}
