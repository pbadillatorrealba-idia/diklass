import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import type { ConsultaDeHoy } from "@/features/agenda/consultas-de-hoy";

const hora = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", { hour: "2-digit", hour12: false, minute: "2-digit" }).format(
    new Date(iso),
  );

/** Filas visibles al inicio: un día cargado no convierte el inicio en un listado interminable. */
const FILAS_INICIALES = 8;

/** Abierta: se retoma en la consulta; cerrada: es historial y se abre en la ficha del paciente. */
function ConsultaFila({ consulta }: { consulta: ConsultaDeHoy }) {
  const abierta = consulta.status === "open";
  return (
    <Link
      asChild
      href={abierta ? `/consultations/${consulta.id}` : `/patients/${consulta.patientId}`}
    >
      <Pressable
        accessibilityLabel={`${abierta ? "Retomar la consulta de" : "Ver la ficha de"} ${consulta.patientName}`}
        className="min-h-touch flex-row items-center gap-3 border-b border-border py-2 focus:outline-none focus:ring-2 focus:ring-ring"
        testID={`home-consulta-${consulta.id}`}
      >
        <Text tone="muted" variant="data">
          {hora(consulta.createdAt)}
        </Text>
        <Text className="flex-1" variant="strong">
          {consulta.patientName}
        </Text>
        <Chip tone={abierta ? "info" : "neutral"}>{abierta ? "Abierta" : "Cerrada"}</Chip>
      </Pressable>
    </Link>
  );
}

/** Contenido de la hoja «Consultas de hoy»: la lista, o el vacío con la acción para empezar. */
export function ConsultasDeHoy({ consultas }: { consultas: readonly ConsultaDeHoy[] }) {
  const [verTodas, setVerTodas] = useState(false);
  if (consultas.length === 0) {
    return (
      <View className="items-start gap-3" testID="home-today-empty">
        <Text tone="muted">
          Cuando abras una consulta hoy, aparecerá aquí para retomarla desde el inicio.
        </Text>
        <Link asChild href="/patients">
          <Button variant="outline">
            <ButtonText>Elegir un paciente</ButtonText>
          </Button>
        </Link>
      </View>
    );
  }
  const visibles = verTodas ? consultas : consultas.slice(0, FILAS_INICIALES);
  const ocultas = consultas.length - visibles.length;
  return (
    <View>
      {visibles.map((consulta) => (
        <ConsultaFila consulta={consulta} key={consulta.id} />
      ))}
      {ocultas > 0 ? (
        <Button className="mt-3 self-start" onPress={() => setVerTodas(true)} variant="ghost">
          <ButtonText>{`Ver las ${ocultas} restantes`}</ButtonText>
        </Button>
      ) : null}
    </View>
  );
}
