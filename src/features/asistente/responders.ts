import type { CalendarEvent } from "@/features/agenda/calendar-event";
import { type Message, messageText, type Part } from "@/features/asistente/chat-model";
import {
  answerAgenda,
  answerFecha,
  detectIntent,
  startOfDay,
} from "@/features/asistente/consultas-basicas";
import { isValidAction, type ProposalAction } from "@/features/asistente/proposal-action";
import type { KnowledgeAnswer } from "@/features/conocimiento/schema";
import { isAllowedRoute } from "../../../supabase/functions/_shared/routes";

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

type AgentDeps = {
  invoke: (body: {
    text: string;
    patientId: string | null;
    since: string;
    history: { role: "user" | "assistant"; text: string }[];
  }) => Promise<{
    text: string;
    ui: { type: "navigate"; path: string }[];
    proposals: { id: string; summary: string; origin: string; action: ProposalAction }[];
  }>;
  navigate: (path: string) => void;
};

/** Últimos turnos que se envían al agente como contexto. */
const HISTORY_TURNS = 10;

/**
 * Agente LangChain (Edge Function `agent`). Solo lee y navega: la UI vuelve a validar la ruta contra la
 * lista blanca antes de abrirla, porque lo que diga el servidor no es de confianza ciega.
 */
export class AgentResponder implements Responder {
  constructor(private readonly deps: AgentDeps) {}

  async *respond(history: readonly Message[], input: ChatInput, signal: AbortSignal) {
    const turns = history
      .filter((m) => m.status === "done")
      .map((m) => ({ role: m.role, text: messageText(m) }))
      .filter((m) => m.text !== "")
      .slice(-HISTORY_TURNS);
    const { text, ui, proposals } = await this.deps.invoke({
      text: input.text,
      patientId: input.patientId,
      since: startOfDay(new Date()).toISOString(),
      history: turns,
    });
    if (signal.aborted) return;
    for (const action of ui) if (isAllowedRoute(action.path)) this.deps.navigate(action.path);
    // Una propuesta que no cumple el catálogo vigente no llega a la pantalla.
    const tarjetas: Part[] = proposals
      .filter((p) => isValidAction(p.action))
      .map((proposal) => ({ type: "proposal", proposal }));
    const listo: ResponseEvent = { type: "ready", parts: [{ type: "text", text }, ...tarjetas] };
    yield listo;
  }
}

/** Con agente, todo lo que no es consulta básica va a él; sin agente, a la base de conocimiento. */
export const routeAgent = (responders: { basico: Responder; agente: Responder }): Responder => ({
  respond: (history, input, signal) =>
    (detectIntent(input.text) ? responders.basico : responders.agente).respond(
      history,
      input,
      signal,
    ),
});
