import { type ReactNode, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AgentProposal } from "@/components/asistente/agent-proposal";
import { MarkdownText } from "@/components/asistente/markdown-text";
import { RespaldoRegistrado } from "@/components/asistente/respaldo-registrado";
import { RespuestaConocimiento } from "@/components/conocimiento/respuesta-conocimiento";
import { Button, ButtonText } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { type AudioPlayback, createAudioPlayback } from "@/features/asistente/audio-playback";
import type { Message, Part } from "@/features/asistente/chat-model";
import { formatElapsed } from "@/features/voz/use-elapsed";

/**
 * Registro `tipo de parte → componente` (asistente-conversacional · design.md D1): un agente futuro
 * añade un tipo aquí sin tocar la lista de mensajes.
 */
export type PartContext = {
  role: Message["role"];
  /** Sin manejador, una propuesta guardada se ve como texto: persistir no es confirmar. */
  onConfirmProposal?: (proposalId: string) => void;
  /** URL firmada de corta vida para reproducir un audio vigente; `null` si ya no está disponible. */
  onPlayAudio?: (path: string) => Promise<string | null>;
};

type Renderers = {
  [K in Part["type"]]: (props: { part: Extract<Part, { type: K }>; ctx: PartContext }) => ReactNode;
};

/** Reproduce un audio enviado: pide la URL firmada al pulsar (no se firma por adelantado). */
function MessageAudioPlayer({
  onPlayAudio,
  path,
}: {
  onPlayAudio: (path: string) => Promise<string | null>;
  path: string;
}) {
  const playback = useRef<AudioPlayback | null>(null);
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(
    () => () => {
      playback.current?.dispose();
      playback.current = null;
    },
    [],
  );

  const toggle = async () => {
    if (!playback.current) {
      const url = await onPlayAudio(path);
      if (url === null) {
        setUnavailable(true);
        return;
      }
      playback.current = createAudioPlayback({ url });
      playback.current.onEnded(() => setPlaying(false));
    }
    if (playing) playback.current.pause();
    else playback.current.play();
    setPlaying(!playing);
  };

  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <Button onPress={() => void toggle()} size="sm" testID="message-play-audio" variant="outline">
        <ButtonText>{playing ? "Pausar audio" : "Reproducir audio"}</ButtonText>
      </Button>
      {unavailable ? (
        <Text role="alert" tone="destructive" variant="caption">
          El audio ya no está disponible.
        </Text>
      ) : null}
    </View>
  );
}

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
  audio: ({ part, ctx }) => (
    <>
      <Text selectable>{part.transcript}</Text>
      {part.audioState === "ready" ? (
        <View className="gap-1">
          <Text tone="muted" variant="caption">
            {`Audio · ${formatElapsed(part.durationMs)}`}
          </Text>
          {ctx.onPlayAudio && part.audioPath ? (
            <MessageAudioPlayer onPlayAudio={ctx.onPlayAudio} path={part.audioPath} />
          ) : null}
        </View>
      ) : (
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
