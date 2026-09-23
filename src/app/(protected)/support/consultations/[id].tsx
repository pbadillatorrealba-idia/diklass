import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { SafeAreaView, ScrollView } from "react-native";
import { PanelInformacionFaltante } from "@/components/asistencia/panel-informacion-faltante";
import { PanelSoporteDiferencial } from "@/components/asistencia/panel-soporte-diferencial";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import {
  decideMissingInformation,
  listSuggestions,
} from "@/features/asistencia/asistencia-service";
import {
  addVetHypothesis,
  decideHypothesis,
  generateDifferentialSupport,
  listHypotheses,
} from "@/features/asistencia/hipotesis-service";
import type {
  DecisionSugerencia,
  Fundamento,
  HipotesisSoportada,
} from "@/features/asistencia/schema";
import type { Suficiencia } from "@/features/asistencia/soporte-diferencial";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Asistencia clínica proactiva de una consulta (FR-008, FR-009, FR-010, FR-022, FR-033 ·
 * US7/US8): información faltante con su fundamento y apoyo al diagnóstico diferencial, todo
 * como apoyo a la decisión sujeta a validación del veterinario.
 */
export default function SupportConsultationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const consultationId = id ?? "";
  const clinicId = useSessionStore((state) => state.clinicId);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);

  const [status, setStatus] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [suficiencia, setSuficiencia] = useState<Suficiencia | null>(null);

  const sugerenciasQuery = useQuery({
    queryKey: ["asistencia", consultationId, "sugerencias"],
    queryFn: () => listSuggestions(supabase, { consultationId }),
  });
  const hipotesisQuery = useQuery({
    queryKey: ["asistencia", consultationId, "hipotesis"],
    queryFn: () => listHypotheses(supabase, { consultationId }),
  });

  const manejarError = (error: unknown, operation: string) => {
    if (isAuthenticationRequired(error)) {
      setAccessState("expired");
      openExpiredDialog();
      return;
    }
    setStatus(error instanceof Error ? error.message : "No se pudo completar la operación.");
    void captureClientError(errorReporter, { error, operation, requestId: makeRequestId() });
  };

  const decidirSugerencia = async (
    sugerencia: { key: string; fundamento: Fundamento },
    estado: DecisionSugerencia,
  ) => {
    if (!clinicId) {
      return;
    }
    setStatus(null);
    try {
      await decideMissingInformation(supabase, {
        clinicId,
        consultationId,
        suggestionKey: sugerencia.key,
        estado,
        fundamento: sugerencia.fundamento,
      });
      await sugerenciasQuery.refetch();
    } catch (error) {
      manejarError(error, "decideMissingInformation");
    }
  };

  const generar = async () => {
    if (!clinicId) {
      return;
    }
    setGenerando(true);
    setStatus(null);
    try {
      const resultado = await generateDifferentialSupport(supabase, {
        clinicId,
        consultationId,
      });
      setSuficiencia(resultado.suficiencia);
      await hipotesisQuery.refetch();
    } catch (error) {
      manejarError(error, "generateDifferentialSupport");
    } finally {
      setGenerando(false);
    }
  };

  const decidirHipotesis = async (
    hipotesis: HipotesisSoportada,
    decision: "accepted" | "discarded",
  ) => {
    setStatus(null);
    try {
      await decideHypothesis(supabase, { hypothesisId: hipotesis.key, decision });
      await hipotesisQuery.refetch();
    } catch (error) {
      manejarError(error, "decideHypothesis");
    }
  };

  const agregarPropia = async (texto: string) => {
    if (!clinicId) {
      return;
    }
    setStatus(null);
    try {
      await addVetHypothesis(supabase, { clinicId, consultationId, texto });
      await hipotesisQuery.refetch();
    } catch (error) {
      manejarError(error, "addVetHypothesis");
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: "#f8fafc", flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <VStack className="w-full max-w-[720px] gap-6">
          <Heading size="lg">Asistencia clínica proactiva</Heading>
          <Text className="text-foreground/70 text-sm">
            Apoyo a la decisión para esta consulta: identificación de información faltante con
            preguntas sugeridas y apoyo al diagnóstico diferencial. Toda salida requiere tu
            validación profesional y distingue dato, inferencia y evidencia documental.
          </Text>

          {status !== null ? (
            <Text className="text-destructive text-sm" testID="asistencia-status">
              {status}
            </Text>
          ) : null}

          <PanelInformacionFaltante
            onDecidir={(sugerencia, estado) =>
              void decidirSugerencia(
                {
                  key: sugerencia.key,
                  fundamento: sugerencia.fundamento,
                },
                estado,
              )
            }
            sugerencias={sugerenciasQuery.data ?? []}
          />

          <PanelSoporteDiferencial
            generando={generando}
            hipotesis={hipotesisQuery.data ?? []}
            onAgregar={(texto) => void agregarPropia(texto)}
            onDecidir={(hipotesis, decision) => void decidirHipotesis(hipotesis, decision)}
            onGenerar={() => void generar()}
            suficiencia={suficiencia}
          />
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
}
