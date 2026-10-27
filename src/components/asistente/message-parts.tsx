import type { ReactNode } from "react";
import { AgentProposal } from "@/components/asistente/agent-proposal";
import { MarkdownText } from "@/components/asistente/markdown-text";
import { RespaldoRegistrado } from "@/components/asistente/respaldo-registrado";
import { RespuestaConocimiento } from "@/components/conocimiento/respuesta-conocimiento";
import { Text } from "@/components/ui/text";
import type { Message, Part } from "@/features/asistente/chat-model";

/**
 * Registro `tipo de parte → componente` (asistente-conversacional · design.md D1): un agente futuro
 * añade un tipo aquí sin tocar la lista de mensajes.
 */
export type PartContext = {
  role: Message["role"];
  /** Sin manejador, una propuesta guardada se ve como texto: persistir no es confirmar. */
  onConfirmProposal?: (proposalId: string) => void;
};

type Renderers = {
  [K in Part["type"]]: (props: { part: Extract<Part, { type: K }>; ctx: PartContext }) => ReactNode;
};

const AUDIO_MARCA = { expired: "audio vencido", deleted: "audio eliminado" } as const;

const RENDERERS: Renderers = {
  // El asistente responde en markdown; lo que escribe el veterinario se muestra tal cual.
  text: ({ part, ctx }) =>
    ctx.role === "assistant" ? (
      <MarkdownText text={part.text} />
    ) : (
      <Text selectable>{part.text}</Text>
    ),
  notice: ({ part }) => (
    <Text tone="muted" variant="caption">
      {part.text}
    </Text>
  ),
  knowledge: ({ part }) => (
    <>
      <RespuestaConocimiento answer={part.answer} />
      <RespaldoRegistrado queryId={part.queryId} />
    </>
  ),
  audio: ({ part }) => (
    <>
      <Text selectable>{part.transcript}</Text>
      {part.audioState === "ready" ? null : (
        <Text tone="muted" variant="caption">
          {AUDIO_MARCA[part.audioState]}
        </Text>
      )}
    </>
  ),
  proposal: ({ part, ctx }) =>
    ctx.onConfirmProposal ? (
      <AgentProposal onConfirm={ctx.onConfirmProposal} proposal={part.proposal} />
    ) : (
      <Text>{part.proposal.summary}</Text>
    ),
};

export function PartView({ part, ctx }: { part: Part; ctx: PartContext }) {
  const Render = RENDERERS[part.type] as (props: { part: Part; ctx: PartContext }) => ReactNode;
  return <>{Render({ part, ctx })}</>;
}
