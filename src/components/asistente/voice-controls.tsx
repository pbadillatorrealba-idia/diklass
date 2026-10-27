import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type AudioPlayback, createAudioPlayback } from "@/features/asistente/audio-playback";
import type { VoiceMessageApi } from "@/features/asistente/use-voice-message";
import { MAX_VOICE_MS } from "@/features/asistente/voice-message";
import type { AudioPayload } from "@/features/voz/transcription-port";
import { formatElapsed } from "@/features/voz/use-elapsed";

type Voice = Pick<
  VoiceMessageApi,
  | "state"
  | "notice"
  | "elapsed"
  | "blockedReason"
  | "start"
  | "stop"
  | "cancel"
  | "discard"
  | "dismissNotice"
>;

/** Conservación del audio (asistente-conversacional «Conservación del audio por 90 días»). */
const RETENCION = "Se conserva 90 días.";

const AVISOS = {
  "too-short": "La grabación fue demasiado corta (mínimo 1 segundo) y no se envió.",
  unavailable:
    "No hay acceso al micrófono o al dispositivo de audio. Puedes escribir tu pregunta en su lugar.",
  blocked: "La escucha de la consulta usa el micrófono.",
  "not-understood": "No se entendió el audio. Puedes grabar de nuevo.",
} as const;

/**
 * Botón de grabar del composer (asistente-conversacional «Grabar, revisar y enviar audio» · tarea 7.4):
 * se graba tocando, sin gestos de puntero. Queda deshabilitado mientras hay otra grabación o la
 * escucha de la consulta usa el micrófono (el motivo lo dice `VoicePanel`).
 */
export function VoiceButton({
  voice,
}: {
  voice: Pick<Voice, "state" | "blockedReason" | "start">;
}) {
  const ocupado = voice.state.kind !== "idle" || voice.blockedReason !== null;
  return (
    <Button
      accessibilityLabel="Grabar un mensaje de voz"
      aria-label="Grabar un mensaje de voz"
      isDisabled={ocupado}
      onPress={() => void voice.start()}
      testID="voice-record"
      variant="outline"
    >
      <Icon decorative name="microphone-outline" />
    </Button>
  );
}

function ReviewPlayer({ payload }: { payload: AudioPayload }) {
  const playback = useRef<AudioPlayback | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(
    () => () => {
      playback.current?.dispose();
      playback.current = null;
    },
    [],
  );

  const toggle = () => {
    if (!playback.current) {
      playback.current = createAudioPlayback({ payload });
      playback.current.onEnded(() => setPlaying(false));
    }
    if (playing) playback.current.pause();
    else playback.current.play();
    setPlaying(!playing);
  };

  return (
    <Button onPress={toggle} size="sm" testID="voice-play" variant="outline">
      <ButtonText>{playing ? "Pausar" : "Reproducir"}</ButtonText>
    </Button>
  );
}

/**
 * Panel del mensaje de voz sobre el composer: grabando (punto, tiempo, Cancelar, Detener), revisión
 * (reproducir, Descartar, Enviar) y avisos. El aviso de grabación y conservación es texto, no solo
 * color. La región de estado anuncia solo el inicio y el fin, y el tiempo queda fuera de ella para no
 * anunciar cada segundo.
 */
export function VoicePanel({ voice, onSend }: { voice: Voice; onSend: () => void }) {
  const { state, notice, blockedReason } = voice;

  if (state.kind === "recording") {
    return (
      <View
        accessibilityLabel="Grabando un mensaje de voz"
        aria-label="Grabando un mensaje de voz"
        className="gap-2 rounded-sm border border-border bg-card p-3"
        role="group"
        testID="voice-panel"
      >
        <View aria-live="polite" role="status" testID="voice-status">
          <View className="flex-row items-center gap-2">
            <Icon decorative name="record-circle" size="sm" tone="destructive" />
            <Text variant="strong">Grabando y conservando audio</Text>
          </View>
        </View>
        <Text tone="muted" variant="caption">
          {`${RETENCION} Máximo 2 minutos.`}
        </Text>
        <Text className="font-mono tabular-nums" testID="voice-elapsed">
          {voice.elapsed}
        </Text>
        <View className="flex-row gap-2">
          <Button onPress={voice.cancel} size="sm" testID="voice-cancel" variant="outline">
            <ButtonText>Cancelar</ButtonText>
          </Button>
          <Button
            onPress={() => void voice.stop()}
            size="sm"
            testID="voice-stop"
            variant="destructive"
          >
            <ButtonText>Detener</ButtonText>
          </Button>
        </View>
      </View>
    );
  }

  if (state.kind === "review") {
    return (
      <View
        className="gap-2 rounded-sm border border-border bg-card p-3"
        role="group"
        testID="voice-panel"
        aria-label="Revisar el mensaje de voz"
      >
        <Text variant="strong">{`Revisa tu mensaje de voz · ${formatElapsed(state.durationMs)}`}</Text>
        {state.autoStopped || state.durationMs >= MAX_VOICE_MS ? (
          <Text tone="muted" variant="caption">
            La grabación llegó al máximo de 2 minutos y se detuvo sola.
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          <ReviewPlayer payload={state.payload} />
          <Button onPress={voice.discard} size="sm" testID="voice-discard" variant="outline">
            <ButtonText>Descartar</ButtonText>
          </Button>
          <Button onPress={onSend} size="sm" testID="voice-send">
            <ButtonText>Enviar</ButtonText>
          </Button>
        </View>
      </View>
    );
  }

  if (state.kind === "sending") {
    return (
      <View aria-live="polite" role="status" testID="voice-panel">
        <Text tone="muted">Enviando audio…</Text>
      </View>
    );
  }

  if (notice !== null) {
    return (
      <View
        aria-live="polite"
        className="gap-2 rounded-sm border border-border bg-card p-3"
        role="status"
        testID="voice-notice"
      >
        <Text>{AVISOS[notice]}</Text>
        <Button className="self-start" onPress={voice.dismissNotice} size="sm" variant="ghost">
          <ButtonText>Entendido</ButtonText>
        </Button>
      </View>
    );
  }

  if (blockedReason !== null) {
    return (
      <Text tone="muted" testID="voice-blocked" variant="caption">
        {blockedReason}
      </Text>
    );
  }
  return null;
}
