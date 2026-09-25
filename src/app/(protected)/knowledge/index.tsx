import { useQuery } from "@tanstack/react-query";
import Head from "expo-router/head";
import { useRef, useState } from "react";
import { RespuestaConocimiento } from "@/components/conocimiento/respuesta-conocimiento";
import { SelectorPacienteContexto } from "@/components/conocimiento/selector-paciente-contexto";
import { Button, ButtonText } from "@/components/ui/button";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { consultKnowledge, getQuery } from "@/features/conocimiento/consulta-service";
import { useConversationStore } from "@/features/conocimiento/conversation-store";
import { PACIENTES_CONTEXTO_QUERY_KEY } from "@/features/conocimiento/query-cache";
import { listPatients } from "@/features/registro/ficha-service";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Conversación con el asistente de la base de conocimiento (FR-005, FR-026 · US5-AC1/AC4):
 * pregunta en lenguaje natural con el contexto del paciente conservado durante la sesión y
 * respuesta citada, con «ver respaldo» sobre lo registrado (FR-020 · US5-AC5).
 */
export default function KnowledgeConversationScreen() {
  const clinicId = useSessionStore((state) => state.clinicId);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const patientId = useConversationStore((state) => state.patientId);
  const turnos = useConversationStore((state) => state.turnos);
  const setPatient = useConversationStore((state) => state.setPatient);
  const addTurno = useConversationStore((state) => state.addTurno);

  const [pregunta, setPregunta] = useState("");
  const [isConsulting, setIsConsulting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [respaldoAbierto, setRespaldoAbierto] = useState<string | null>(null);
  // Candado síncrono: `isConsulting` no cambia hasta el siguiente render, y un segundo Enter
  // en ese intervalo registraría otra fila append-only (revisión de la PR #30).
  const consultando = useRef(false);

  const pacientesQuery = useQuery({
    queryKey: PACIENTES_CONTEXTO_QUERY_KEY,
    queryFn: () => listPatients(supabase),
  });
  const respaldoQuery = useQuery({
    queryKey: ["conocimiento", "query", respaldoAbierto],
    queryFn: () => getQuery(supabase, respaldoAbierto as string),
    enabled: respaldoAbierto !== null,
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

  const consultar = async () => {
    // Mismas condiciones que el botón deshabilitado: Enter no puede saltárselas.
    if (!clinicId || consultando.current || pregunta.trim() === "") {
      return;
    }
    consultando.current = true;
    setIsConsulting(true);
    setStatus(null);
    try {
      const { queryId, answer } = await consultKnowledge(supabase, {
        clinicId,
        pregunta,
        patientId,
      });
      addTurno({ id: queryId, pregunta: pregunta.trim(), queryId, respuesta: answer });
      setPregunta("");
    } catch (error) {
      manejarError(error, "consultKnowledge");
    } finally {
      consultando.current = false;
      setIsConsulting(false);
    }
  };

  return (
    <Screen>
      <Head>
        <title>Base de conocimiento · Diklass</title>
      </Head>
      <Heading level={2}>Base de conocimiento · Consulta</Heading>
      <Text tone="muted" variant="caption">
        Pregunta en lenguaje natural sobre protocolos, literatura o medicamentos. Toda respuesta se
        apoya en la colección documental y distingue fuente, ficha e inferencia.
      </Text>

      <SelectorPacienteContexto
        onChange={setPatient}
        pacientes={pacientesQuery.data ?? []}
        patientId={patientId}
      />

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText>Tu pregunta al asistente</FormControlLabelText>
        </FormControlLabel>
        <Input>
          <InputField
            accessibilityLabel="Tu pregunta al asistente"
            onChangeText={setPregunta}
            onSubmitEditing={() => void consultar()}
            placeholder="¿Qué antecedentes revisar ante un posible cuadro de ansiedad por separación?"
            testID="conocimiento-pregunta"
            value={pregunta}
          />
        </Input>
      </FormControl>
      <Button
        isDisabled={isConsulting || pregunta.trim() === ""}
        onPress={() => void consultar()}
        testID="conocimiento-consultar"
      >
        <ButtonText>{isConsulting ? "Consultando…" : "Consultar"}</ButtonText>
      </Button>

      {status !== null ? (
        <Text tone="destructive" variant="caption" testID="conocimiento-status">
          {status}
        </Text>
      ) : null}

      {turnos.map((turno) => (
        <VStack className="gap-2" key={turno.id} testID={`turno-${turno.id}`}>
          <Heading level={3}>{turno.pregunta}</Heading>
          <RespuestaConocimiento answer={turno.respuesta} />
          {turno.queryId !== null ? (
            <Button
              className="self-start"
              onPress={() =>
                setRespaldoAbierto(respaldoAbierto === turno.queryId ? null : turno.queryId)
              }
              testID={`ver-respaldo-${turno.id}`}
            >
              <ButtonText>
                {respaldoAbierto === turno.queryId ? "Ocultar respaldo" : "Ver respaldo registrado"}
              </ButtonText>
            </Button>
          ) : null}
          {respaldoAbierto === turno.queryId && respaldoQuery.data != null ? (
            <VStack className="gap-2 rounded-lg border border-border bg-card p-3">
              <Text tone="muted" variant="caption">
                Reconstrucción de lo que produjo esta recomendación (FR-020): consulta{" "}
                {respaldoQuery.data.row.id}, paciente{" "}
                {respaldoQuery.data.row.patient_id ?? "ninguno"}.
              </Text>
              <RespuestaConocimiento answer={respaldoQuery.data.answer} />
            </VStack>
          ) : null}
        </VStack>
      ))}
    </Screen>
  );
}
