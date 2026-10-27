import type { AgentProposalData } from "@/components/asistente/agent-proposal";
import type { KnowledgeAnswer } from "@/features/conocimiento/schema";

/**
 * Modelo del chat del asistente (asistente-conversacional · design.md D1 · D3), independiente de la
 * interfaz: un mensaje es una lista de partes y un registro `tipo → componente` pinta cada una, así
 * un agente futuro añade tipos sin tocar la lista.
 */
export type MessageStatus = "sending" | "thinking" | "done" | "error";

export type Part =
  | { type: "text"; text: string }
  | { type: "knowledge"; queryId: string; answer: KnowledgeAnswer }
  | {
      type: "audio";
      durationMs: number;
      transcript: string;
      audioPath: string | null;
      audioState: "ready" | "expired" | "deleted";
    }
  | { type: "proposal"; proposal: AgentProposalData }
  | { type: "notice"; text: string };

export type Message = {
  id: string;
  role: "user" | "assistant";
  createdAt: string;
  status: MessageStatus;
  /** Paciente vigente al enviarse el mensaje (no el de cuando llega la respuesta). */
  patientId: string | null;
  parts: Part[];
};

/** Solo los mensajes terminales se persisten; «enviando» y «pensando» viven en la sesión (D3). */
export const isPersistable = (message: Message) =>
  message.status === "done" || message.status === "error";

const TRANSITIONS: Record<MessageStatus, readonly MessageStatus[]> = {
  sending: ["thinking", "done", "error"],
  thinking: ["done", "error"],
  done: [],
  // «Reintentar» reenvía el mismo mensaje sin duplicarlo.
  error: ["sending"],
};

export const canTransition = (from: MessageStatus, to: MessageStatus) =>
  TRANSITIONS[from].includes(to);

/** Texto plano de un mensaje, para «Copiar». */
export function messageText(message: Message): string {
  return message.parts
    .map((part) => {
      switch (part.type) {
        case "text":
        case "notice":
          return part.text;
        case "audio":
          return part.transcript;
        case "knowledge":
          return part.answer.segmentos.map((segmento) => segmento.texto).join("\n");
        case "proposal":
          return part.proposal.summary;
      }
    })
    .filter((texto) => texto !== "")
    .join("\n\n");
}
