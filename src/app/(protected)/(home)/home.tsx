import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useWindowDimensions, View } from "react-native";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { ConsultasDeHoy } from "@/components/home/consultas-de-hoy";
import { useReportQueryError } from "@/components/registro/use-report-query-error";
import { Button, ButtonText } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormSection } from "@/components/ui/form-section";
import { Heading } from "@/components/ui/heading";
import { QueryState } from "@/components/ui/query-state";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { consultasDeHoy, resumenDelDia } from "@/features/agenda/consultas-de-hoy";
import { supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";

const fechaDeHoy = (now: Date) =>
  new Intl.DateTimeFormat("es-CL", { dateStyle: "full" }).format(now);

/**
 * Panorama del día: las consultas de hoy (abiertas primero) y, aparte, la agenda. La agenda no
 * tiene fuente de eventos (FR-094), así que el día se arma con las consultas reales, nunca con
 * citas simuladas.
 */
export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const compact = process.env.EXPO_OS !== "web" || width < 1024;
  const displayName = useSessionStore((state) => state.displayName);

  const hoy = useQuery({
    queryKey: ["agenda", "consultas-de-hoy"],
    queryFn: () => consultasDeHoy(supabase, new Date()),
  });
  const queryError = hoy.error;
  useReportQueryError(queryError, "consultas_de_hoy");
  const consultas = hoy.data ?? [];

  return (
    <Screen
      action={
        compact ? undefined : (
          // Las consultas cuelgan de un paciente: iniciar una es elegir primero el paciente.
          <Link asChild href="/patients">
            <Button accessibilityLabel="Iniciar consulta" testID="home-start-consultation">
              <ButtonText>Iniciar consulta</ButtonText>
            </Button>
          </Link>
        )
      }
      pretitle="Hola"
      title={displayName ?? undefined}
      width="wide"
    >
      <Text tone="muted">
        {fechaDeHoy(new Date())}
        {hoy.isSuccess ? `. ${resumenDelDia(consultas)}.` : ""}
      </Text>
      {/* Desde `lg`, el día a la izquierda y la agenda a la derecha (design.md D18). */}
      <View className="gap-6 lg:flex-row lg:items-start">
        <View className="lg:flex-[3]">
          <FormSection testID="home-today" title="Consultas de hoy">
            <QueryState
              empty={<ConsultasDeHoy consultas={[]} />}
              error={queryError}
              errorMessage="No pudimos cargar las consultas de hoy."
              isEmpty={hoy.isSuccess && consultas.length === 0}
              isPending={hoy.isPending}
              onRetry={() => void hoy.refetch()}
              testID="home-today-state"
            >
              <ConsultasDeHoy consultas={consultas} />
            </QueryState>
          </FormSection>
        </View>
        {/* Agenda (FR-094): vacía hasta que exista una fuente de eventos. */}
        <Card className="gap-3 lg:flex-[2]" testID="home-agenda">
          <Heading level={2}>Agenda</Heading>
          <MonthCalendar events={[]} />
        </Card>
      </View>
    </Screen>
  );
}
