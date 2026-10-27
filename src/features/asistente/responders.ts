import type { CalendarEvent } from "@/features/agenda/calendar-event";
import type { Message, Part } from "@/features/asistente/chat-model";
import { answerAgenda, answerFecha, detectIntent } from "@/features/asistente/consultas-basicas";
import type { KnowledgeAnswer } from "@/features/conocimiento/schema";

/**
 * Puerto del asistente (asistente-conversacional · design.md D2): una respuesta es un iterable de
 * eventos, así que un agente con streaming entra sin cambiar la interfaz. Hoy cada respondedor emite
 * un único «listo» con la respuesta entera; `signal` alimenta «Detener».
 */
export type ChatInput = { text: string; patientId: string | null };

export type ResponseEvent = { type: "delta"; text: string } | { type: "ready"; parts: Part[] };

export interface Responder {
  respond(
    history: readonly Message[],
    input: ChatInput,
    signal: AbortSignal,
  ): AsyncIterable<ResponseEvent>;
}

type BasicDeps = {
  now: () => Date;
  events: () => readonly CalendarEvent[];
  pacientesDeHoy: (now: Date) => Promise<string>;
};

/** Fecha, agenda y pacientes de hoy por reglas deterministas (`consultas-basicas.ts`). */
export class BasicResponder implements Responder {
  constructor(private readonly deps: BasicDeps) {}

  async *respond(_history: readonly Message[], input: ChatInput, signal: AbortSignal) {
    const now = this.deps.now();
    const intent = detectIntent(input.text);
    const text =
      intent === "fecha"
        ? answerFecha(now)
        : intent === "agenda"
          ? answerAgenda(this.deps.events(), now)
          : await this.deps.pacientesDeHoy(now);
    // «Detener»: lo que llegue después se descarta.
    if (signal.aborted) return;
    const listo: ResponseEvent = { type: "ready", parts: [{ type: "text", text }] };
    yield listo;
  }
}

type KnowledgeDeps = {
  consult: (
    pregunta: string,
    patientId: string | null,
  ) => Promise<{ queryId: string; answer: KnowledgeAnswer }>;
};

/**
 * Pregunta a la base de conocimiento con el paciente de contexto. «Detener» descarta la respuesta,
 * pero la consulta ya lanzada queda registrada en `knowledge_queries` (FR-020). Un fallo se propaga:
 * el mensaje queda en error con «Reintentar».
 */
export class KnowledgeResponder implements Responder {
  constructor(private readonly deps: KnowledgeDeps) {}

  async *respond(_history: readonly Message[], input: ChatInput, signal: AbortSignal) {
    const { queryId, answer } = await this.deps.consult(input.text, input.patientId);
    if (signal.aborted) return;
    const listo: ResponseEvent = { type: "ready", parts: [{ type: "knowledge", queryId, answer }] };
    yield listo;
  }
}

/** Elige por `detectIntent`: lo que no es consulta básica va a la base de conocimiento. */
export function routeResponder(responders: {
  basico: Responder;
  conocimiento: Responder;
}): Responder {
  return {
    respond: (history, input, signal) =>
      (detectIntent(input.text) ? responders.basico : responders.conocimiento).respond(
        history,
        input,
        signal,
      ),
  };
}
