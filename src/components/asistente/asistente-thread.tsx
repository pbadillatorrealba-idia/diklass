import { useRef, useState } from "react";
import { RespuestaConocimiento } from "@/components/conocimiento/respuesta-conocimiento";
import { Button, ButtonText } from "@/components/ui/button";
import { FormControl, FormControlLabel, FormControlLabelText } from "@/components/ui/form-control";
import { Heading } from "@/components/ui/heading";
import { Input, InputField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VStack } from "@/components/ui/vstack";
import { useAgendaEvents } from "@/features/agenda/use-agenda-events";
import { useAsistenteStore } from "@/features/asistente/asistente-store";
import {
  answerAgenda,
  answerFecha,
  answerPacientesHoy,
  detectIntent,
  startOfDay,
} from "@/features/asistente/consultas-basicas";
import { consultKnowledge } from "@/features/conocimiento/consulta-service";
import { useConversationStore } from "@/features/conocimiento/conversation-store";
import { listConsultationsSince } from "@/features/registro/consultation-service";
import { listPatients } from "@/features/registro/ficha-service";
import { isAuthenticationRequired } from "@/lib/errors";
import { captureClientError, makeRequestId } from "@/lib/observability/client-error-reporter";
import { errorReporter, supabase } from "@/lib/supabase/client";
import { useSessionStore } from "@/stores/session-store";
import { useUiStore } from "@/stores/ui-store";

const SUGERENCIAS = [
  "¿Qué día es hoy?",
  "¿Qué eventos tengo agendados?",
  "¿Cuáles son los pacientes de hoy?",
] as const;

async function pacientesDeHoy(now: Date) {
  const [consultas, pacientes] = await Promise.all([
    listConsultationsSince(supabase, startOfDay(now).toISOString()),
    listPatients(supabase),
  ]);
  return answerPacientesHoy(
    consultas.map(({ record, content }) => ({
      patientId: content.patientId,
      createdAt: record.created_at,
    })),
    new Map(pacientes.map(({ record, content }) => [record.id, content.name])),
    now,
  );
}

/**
 * Hilo «Asistente» del panel (repetible en cualquier pantalla del shell): responde consultas
 * básicas —fecha, agenda, pacientes de hoy— y, lo que no reconoce, lo pregunta a la base de
 * conocimiento con el paciente de contexto (FR-005 · FR-026). No es un agente: no escribe en el
 * registro ni propone cambios; eso es un cambio futuro (contrato `AgentProposal`).
 */
export function AsistenteThread() {
  const clinicId = useSessionStore((state) => state.clinicId);
  const setAccessState = useSessionStore((state) => state.setAccessState);
  const openExpiredDialog = useUiStore((state) => state.openSessionExpiredDialog);
  const patientId = useConversationStore((state) => state.patientId);
  const turnos = useAsistenteStore((state) => state.turnos);
  const addTurno = useAsistenteStore((state) => state.addTurno);
  const events = useAgendaEvents();

  const [pregunta, setPregunta] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  // Candado síncrono: un segundo Enter antes del siguiente render no debe duplicar la consulta.
  const asking = useRef(false);

  const preguntar = async (texto: string) => {
    const question = texto.trim();
    if (asking.current || question === "") return;
    asking.current = true;
    setIsAsking(true);
    setStatus(null);
    const id = `${Date.now()}-${turnos.length}`;
    try {
      const now = new Date();
      const intent = detectIntent(question);
      if (intent === "fecha") {
        addTurno({ id, pregunta: question, respuesta: { tipo: "texto", texto: answerFecha(now) } });
      } else if (intent === "agenda") {
        addTurno({
          id,
          pregunta: question,
          respuesta: { tipo: "texto", texto: answerAgenda(events, now) },
        });
      } else if (intent === "pacientes-hoy") {
        addTurno({
          id,
          pregunta: question,
          respuesta: { tipo: "texto", texto: await pacientesDeHoy(now) },
        });
      } else {
        if (!clinicId) return;
        const { queryId, answer } = await consultKnowledge(supabase, {
          clinicId,
          pregunta: question,
          patientId,
        });
        addTurno({ id: queryId, pregunta: question, respuesta: { tipo: "conocimiento", answer } });
      }
      setPregunta("");
    } catch (error) {
      if (isAuthenticationRequired(error)) {
        setAccessState("expired");
        openExpiredDialog();
      } else {
        setStatus(error instanceof Error ? error.message : "No se pudo completar la consulta.");
        void captureClientError(errorReporter, {
          error,
          operation: "asistente_consulta",
          requestId: makeRequestId(),
        });
      }
    } finally {
      asking.current = false;
      setIsAsking(false);
    }
  };

  return (
    <>
      <Text tone="muted" variant="caption">
        Pregunta por la fecha, tu agenda o los pacientes de hoy; lo demás lo busco en la base de
        conocimiento. No escribo en el registro clínico.
      </Text>

      {turnos.length === 0 ? (
        <VStack className="gap-2" testID="asistente-sugerencias">
          {SUGERENCIAS.map((sugerencia) => (
            <Button
              className="items-start"
              isDisabled={isAsking}
              key={sugerencia}
              onPress={() => void preguntar(sugerencia)}
              variant="outline"
            >
              <ButtonText>{sugerencia}</ButtonText>
            </Button>
          ))}
        </VStack>
      ) : null}

      <FormControl>
        <FormControlLabel>
          <FormControlLabelText>Tu pregunta al asistente</FormControlLabelText>
        </FormControlLabel>
        <Input>
          <InputField
            accessibilityLabel="Tu pregunta al asistente"
            onChangeText={setPregunta}
            onSubmitEditing={() => void preguntar(pregunta)}
            placeholder="Escribe tu pregunta"
            testID="asistente-pregunta"
            value={pregunta}
          />
        </Input>
      </FormControl>
      <Button
        isDisabled={isAsking || pregunta.trim() === ""}
        onPress={() => void preguntar(pregunta)}
        testID="asistente-preguntar"
      >
        <ButtonText>{isAsking ? "Consultando…" : "Preguntar"}</ButtonText>
      </Button>

      {status !== null ? (
        <Text tone="destructive" variant="caption" testID="asistente-status">
          {status}
        </Text>
      ) : null}

      {turnos.map((turno) => (
        <VStack className="gap-2" key={turno.id} testID={`asistente-turno-${turno.id}`}>
          <Heading level={3}>{turno.pregunta}</Heading>
          {turno.respuesta.tipo === "texto" ? (
            <Text selectable testID="asistente-respuesta">
              {turno.respuesta.texto}
            </Text>
          ) : (
            <RespuestaConocimiento answer={turno.respuesta.answer} />
          )}
        </VStack>
      ))}
    </>
  );
}
